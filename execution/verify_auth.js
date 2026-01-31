const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:3001';

async function verifyAuth() {
    console.log('🔍 Starting Auth Verification...\n');
    let errors = 0;

    // 1. Verify Google Auth URL Generation
    try {
        console.log('1. Testing Google Auth URL Generation...');
        const res = await axios.get(`${BASE_URL}/api/auth/google?state=login`);
        if (res.data.url && res.data.url.includes('accounts.google.com')) {
            console.log('✅ Google Auth URL is valid.');
        } else {
            console.error('❌ Google Auth URL missing or invalid:', res.data);
            errors++;
        }
    } catch (err) {
        console.error('❌ Google Auth Endpoint Failed:', err.code, err.message);
        if (err.response) console.error('Status:', err.response.status, 'Data:', err.response.data);
        errors++;
    }

    // 2. Verify Email Signup
    const testUser = {
        name: 'Auth Test User',
        email: `authtest_${Date.now()}@example.com`,
        password: 'password123',
        company_name: 'Test Corp',
        role: 'Admin'
    };

    let token = null;

    try {
        console.log('\n2. Testing Signup...');
        const res = await axios.post(`${BASE_URL}/api/auth/signup`, testUser);
        if (res.data.token && res.data.user.email === testUser.email) {
            console.log('✅ Signup Successful. Token received.');
            token = res.data.token;
        } else {
            console.error('❌ Signup Response invalid:', res.data);
            errors++;
        }
    } catch (err) {
        console.error('❌ Signup Failed:', err.response?.data || err.message);
        errors++;
    }

    // 3. Verify Login (using created user)
    try {
        console.log('\n3. Testing Login...');
        const res = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        if (res.data.token) {
            console.log('✅ Login Successful. Token received.');
            // Update token just in case
            token = res.data.token;
        } else {
            console.error('❌ Login Response invalid:', res.data);
            errors++;
        }
    } catch (err) {
        console.error('❌ Login Failed:', err.response?.data || err.message);
        errors++;
    }

    // 4. Verify Protected Route (Profile)
    if (token) {
        try {
            console.log('\n4. Testing Protected Route (/api/user/profile)...');
            const res = await axios.get(`${BASE_URL}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.profile.email === testUser.email) {
                console.log('✅ Profile Fetch Successful. User identity confirmed.');
            } else {
                console.error('❌ Profile Mismatch:', res.data);
                errors++;
            }
        } catch (err) {
            console.error('❌ Protected Route Failed:', err.response?.data || err.message);
            errors++;
        }
    } else {
        console.warn('⚠️ Skipping Step 4 (No Token)');
    }

    console.log('\n---------------------------------');
    if (errors === 0) {
        console.log('🎉 ALL CHECKS PASSED');
    } else {
        console.log(`⚠️ FOUND ${errors} ERRORS`);
    }
}

verifyAuth();
