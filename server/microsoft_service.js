// server/microsoft_service.js
const msal = require('@azure/msal-node');
const db = require('./database');
require('dotenv').config();
require('isomorphic-fetch');

class MicrosoftService {
    constructor() {
        this.config = {
            auth: {
                clientId: process.env.MICROSOFT_CLIENT_ID,
                authority: `https://login.microsoftonline.com/common`,
                clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            },
            cache: {
                cachePlugin: {
                    beforeCacheAccess: async (cacheContext) => {
                        const userId = cacheContext.tokenCache.userId; // Custom property we'll set
                        if (!userId) return;

                        return new Promise((resolve, reject) => {
                            db.getDb().get('SELECT microsoft_cache FROM users WHERE id = ?', [userId], (err, row) => {
                                if (err) {
                                    console.error('[MSAL Cache] Read Error:', err);
                                    resolve();
                                } else {
                                    if (row && row.microsoft_cache) {
                                        cacheContext.tokenCache.deserialize(row.microsoft_cache);
                                    }
                                    resolve();
                                }
                            });
                        });
                    },
                    afterCacheAccess: async (cacheContext) => {
                        const userId = cacheContext.tokenCache.userId;
                        if (cacheContext.cacheHasChanged && userId) {
                            return new Promise((resolve, reject) => {
                                const cacheData = cacheContext.tokenCache.serialize();
                                db.getDb().run('UPDATE users SET microsoft_cache = ? WHERE id = ?', [cacheData, userId], (err) => {
                                    if (err) console.error('MSAL Cache Write Error:', err);
                                    resolve();
                                });
                            });
                        }
                    }
                }
            }
        };

        if (this.config.auth.clientId && this.config.auth.clientSecret) {
            this.cca = new msal.ConfidentialClientApplication(this.config);
        } else {
            console.warn('Microsoft credentials missing. MicrosoftService disabled.');
        }

        this.defaultRedirectUri = 'http://localhost:3001/api/auth/microsoft/callback';
    }

    async getAuthUrl(state, redirectUriOverride) {
        if (!this.cca) throw new Error('Microsoft Service not configured');
        const authCodeUrlParameters = {
            scopes: ['user.read', 'mail.read', 'mail.send', 'calendars.readwrite', 'OnlineMeetings.ReadWrite', 'offline_access', 'openid', 'profile'],
            redirectUri: redirectUriOverride || this.defaultRedirectUri,
            prompt: 'select_account',
            state: state
        };
        return await this.cca.getAuthCodeUrl(authCodeUrlParameters);
    }

    async getTokenFromCode(code, redirectUriOverride) {
        if (!this.cca) throw new Error('Microsoft Service not configured');
        const tokenRequest = {
            code: code,
            scopes: ['user.read', 'mail.read', 'mail.send', 'calendars.readwrite', 'OnlineMeetings.ReadWrite', 'offline_access', 'openid', 'profile'],
            redirectUri: redirectUriOverride || this.defaultRedirectUri,
        };
        const response = await this.cca.acquireTokenByCode(tokenRequest);
        return response;
    }

    async getAccessToken(user) {
        console.log('[MSAL] getAccessToken for user:', user.email);
        if (!this.cca) throw new Error('Microsoft Service not configured');

        // Seed the cache with the userId
        const tokenCache = this.cca.getTokenCache();
        tokenCache.userId = user.id;

        const accounts = await tokenCache.getAllAccounts();

        if (accounts.length === 0) {
            // If cache is empty, we must rely on the stored response to seed it or prompt re-auth
            if (user.microsoft_refresh_token) {
                // MSAL Node CCA doesn't expose a straightforward "seed cache from token" method easily
                // but acquireTokenSilent with the account from the stored response usually works IF the cache plugin loaded it.
                const stored = JSON.parse(user.microsoft_refresh_token);
                if (stored.account) {
                    try {
                        const result = await this.cca.acquireTokenSilent({
                            account: stored.account,
                            scopes: ['user.read', 'mail.read', 'mail.send', 'calendars.readwrite', 'OnlineMeetings.ReadWrite', 'offline_access', 'openid', 'profile']
                        });
                        return result.accessToken;
                    } catch (e) {
                        console.warn('Silent token acquisition failed:', e.message);
                        return stored.accessToken; // Fallback
                    }
                }
                return stored.accessToken;
            }
            throw new Error('No accounts found in MSAL cache and no fallback token available.');
        }

        try {
            const silentRequest = {
                account: accounts[0],
                scopes: ['user.read', 'mail.read', 'mail.send', 'calendars.readwrite', 'OnlineMeetings.ReadWrite', 'offline_access', 'openid', 'profile']
            };
            const result = await this.cca.acquireTokenSilent(silentRequest);
            return result.accessToken;
        } catch (error) {
            console.error('Failed to get MS access token silently:', error);
            // Last ditch: return the old one if it still exists
            if (user.microsoft_refresh_token) {
                return JSON.parse(user.microsoft_refresh_token).accessToken;
            }
            throw error;
        }
    }

    getGraphClient(accessToken) {
        const { Client } = require('@microsoft/microsoft-graph-client');
        return Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            }
        });
    }

    async listEvents(user) {
        const accessToken = await this.getAccessToken(user);
        const client = this.getGraphClient(accessToken);

        const now = new Date().toISOString();
        const res = await client.api('/me/events')
            .filter(`start/dateTime ge '${now}'`)
            .select('subject,bodyPreview,start,end,webLink,onlineMeeting,isOnlineMeeting')
            .top(10)
            .orderby('start/dateTime')
            .get();

        return res.value.map(evt => ({
            id: evt.id,
            summary: evt.subject,
            start: { dateTime: evt.start.dateTime },
            end: { dateTime: evt.end.dateTime },
            hangoutLink: evt.onlineMeeting ? evt.onlineMeeting.joinUrl : null,
            htmlLink: evt.webLink
        }));
    }

    async createEvent(user, eventData) {
        const accessToken = await this.getAccessToken(user);
        const client = this.getGraphClient(accessToken);

        const isOnline = eventData.meetingProvider === 'auto' || eventData.meetingProvider === 'teams';
        let bodyContent = eventData.description || '';

        if (!isOnline && eventData.meetingLink) {
            bodyContent += `\n\nJoin Meeting: ${eventData.meetingLink}`;
        }

        const event = {
            subject: eventData.summary || 'Interview',
            body: {
                contentType: 'HTML',
                content: bodyContent.replace(/\n/g, '<br>')
            },
            start: { dateTime: eventData.startTime, timeZone: 'UTC' },
            end: { dateTime: eventData.endTime, timeZone: 'UTC' },
            attendees: eventData.candidateEmail ? [{
                emailAddress: { address: eventData.candidateEmail, name: 'Candidate' },
                type: 'required'
            }] : [],
            isOnlineMeeting: isOnline
        };

        const res = await client.api('/me/events').post(event);

        return {
            id: res.id,
            hangoutLink: res.onlineMeeting ? res.onlineMeeting.joinUrl : null,
            htmlLink: res.webLink
        };
    }

    async sendEmail(user, emailData) {
        const accessToken = await this.getAccessToken(user);
        const client = this.getGraphClient(accessToken);

        const message = {
            message: {
                subject: emailData.subject,
                body: {
                    contentType: 'HTML',
                    content: emailData.message.replace(/\n/g, '<br>')
                },
                toRecipients: [{ emailAddress: { address: emailData.to } }],
                inferenceClassification: 'focused'
            }
        };

        try {
            await client.api('/me/sendMail').post(message);
            return { id: 'sent-via-graph' };
        } catch (error) {
            console.error('Graph Send error details:', error);
            throw error;
        }
    }

    async listMessages(user, query, candidateEmails = []) {
        const accessToken = await this.getAccessToken(user);
        const client = this.getGraphClient(accessToken);

        let request = client.api('/me/messages')
            .top(30)
            .select('id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead')
            .orderby('receivedDateTime desc');

        if (candidateEmails && candidateEmails.length > 0) {
            // Use $search for better compatibility with personal accounts
            const searchQuery = candidateEmails.slice(0, 10).map(e => `"${e}"`).join(' OR ');
            request = request.search(searchQuery);
        }

        if (query && (!candidateEmails || candidateEmails.length === 0)) {
            request = request.search(`"${query}"`);
        }

        // Add ConsistencyLevel header for $search and complex queries
        request = request.header('ConsistencyLevel', 'eventual');

        const res = await request.get();

        return res.value.map(msg => ({
            id: msg.id,
            threadId: msg.conversationId,
            snippet: msg.bodyPreview,
            body: msg.body?.content || msg.bodyPreview,
            from: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown',
            to: msg.toRecipients?.[0]?.emailAddress?.address || '',
            subject: msg.subject || '(No Subject)',
            date: msg.receivedDateTime,
            labelIds: msg.isRead ? ['READ'] : ['UNREAD']
        }));
    }

    async getThread(user, threadId) {
        const accessToken = await this.getAccessToken(user);
        const client = this.getGraphClient(accessToken);

        const res = await client.api('/me/messages')
            .filter(`conversationId eq '${threadId}'`)
            .select('id,subject,from,toRecipients,receivedDateTime,bodyPreview,body')
            .orderby('receivedDateTime asc')
            .get();

        return res.value.map(msg => ({
            id: msg.id,
            threadId: msg.conversationId,
            snippet: msg.bodyPreview,
            body: msg.body.content,
            from: msg.from?.emailAddress?.address,
            to: msg.toRecipients?.[0]?.emailAddress?.address,
            subject: msg.subject,
            date: msg.receivedDateTime
        }));
    }
}

module.exports = new MicrosoftService();
