const querystring = require('querystring');
require('isomorphic-fetch'); // Ensure fetch is available

class ZoomService {
    constructor() {
        this.clientId = process.env.ZOOM_CLIENT_ID;
        this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
        this.redirectUri = 'http://localhost:3001/api/auth/zoom/callback';
        this.baseUrl = 'https://zoom.us';
        this.apiUrl = 'https://api.zoom.us/v2';
    }

    getAuthUrl(redirectUriOverride) {
        if (!this.clientId) throw new Error('Zoom Client ID not configured');
        const params = {
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: redirectUriOverride || this.redirectUri,
            scope: 'meeting:write:meeting'
        };
        return `${this.baseUrl}/oauth/authorize?${querystring.stringify(params)}`;
    }

    async getToken(code, redirectUriOverride) {
        if (!this.clientId || !this.clientSecret) throw new Error('Zoom credentials not configured');

        try {
            const response = await fetch(`${this.baseUrl}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: querystring.stringify({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: redirectUriOverride || this.redirectUri
                })
            });

            if (!response.ok) {
                const errorData = await response.json(); // safely try to parse
                throw new Error(errorData.error_description || response.statusText);
            }

            const data = await response.json();
            return {
                refresh_token: data.refresh_token,
                access_token: data.access_token,
                expires_in: data.expires_in
            };
        } catch (error) {
            console.error('Zoom Token Error:', error.message);
            throw new Error('Failed to exchange code for token');
        }
    }

    async refreshAccessToken(refreshToken) {
        try {
            const response = await fetch(`${this.baseUrl}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: querystring.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || response.statusText);
            }

            const data = await response.json();
            return {
                refresh_token: data.refresh_token,
                access_token: data.access_token
            };
        } catch (error) {
            console.error('Zoom Refresh Error:', error.message);
            throw new Error('Failed to refresh access token');
        }
    }

    async createMeeting(user, eventData) {
        let refreshToken = user.zoom_refresh_token;
        if (!refreshToken) throw new Error('User not connected to Zoom');

        // Always refresh first for simplicity (or check expiry if we stored it)
        // Zoom tokens expire fast (1 hour access token)
        let accessToken;
        let newRefreshToken;
        try {
            const tokens = await this.refreshAccessToken(refreshToken);
            accessToken = tokens.access_token;
            newRefreshToken = tokens.refresh_token;
        } catch (e) {
            throw e;
        }

        const meetingDetails = {
            topic: eventData.summary || 'Interview',
            type: 2, // Scheduled meeting
            start_time: eventData.startTime, // "YYYY-MM-DDTHH:MM:SSZ"
            duration: 45, // Default duration if not calc
            agenda: eventData.description,
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                mute_upon_entry: true,
                waiting_room: false
            }
        };

        const response = await fetch(`${this.apiUrl}/users/me/meetings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(meetingDetails)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error('Zoom API Error: ' + error);
        }

        const data = await response.json();

        return {
            id: data.id,
            joinUrl: data.join_url,
            startUrl: data.start_url,
            password: data.password,
            newRefreshToken: newRefreshToken
        };
    }

    // Improved createMeeting with token handling
    async createMeetingWithTokenHandling(user, eventData, saveTokenCallback) {
        let refreshToken = user.zoom_refresh_token;
        if (!refreshToken) throw new Error('User not connected to Zoom');

        // 1. Refresh Token
        const tokens = await this.refreshAccessToken(refreshToken);
        const accessToken = tokens.access_token;
        const newRefreshToken = tokens.refresh_token;

        // 2. Save new refresh token
        if (saveTokenCallback && newRefreshToken) {
            await saveTokenCallback(newRefreshToken);
        }

        // 3. Create Meeting
        const meetingDetails = {
            topic: eventData.summary || 'Interview',
            type: 2,
            start_time: eventData.startTime,
            duration: 60,
            agenda: eventData.description,
            settings: {
                join_before_host: true
            }
        };

        const response = await fetch(`${this.apiUrl}/users/me/meetings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(meetingDetails)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error('Zoom API Error: ' + error);
        }

        const data = await response.json();

        return {
            id: data.id,
            joinUrl: data.join_url
        };
    }
}

module.exports = new ZoomService();
