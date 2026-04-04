const jsforce = require('jsforce');
const LocalStorage = require('node-localstorage').LocalStorage;
const lcStorage = new LocalStorage('./info');
const {
    SF_LOGIN_URL,
    SF_CLIENT_ID,
    SF_CLIENT_SECRET,
    SF_CALLBACK_URL,
    APP_URL
} = require('../config');

// Initialize OAuth2 config
const oauth2 = new jsforce.OAuth2({
    loginUrl: SF_LOGIN_URL,
    clientId: SF_CLIENT_ID,
    clientSecret: SF_CLIENT_SECRET,
    redirectUri: SF_CALLBACK_URL
});

// Function to perform Salesforce login
const login = (req, res) => {
    res.redirect(
        oauth2.getAuthorizationUrl({
            scope: 'full'
        })
    );
};

// Callback function to get Salesforce auth token
const callback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        console.log('Failed to get authorization code from server callback');
        return res.status(500).send('Failed to get authorization code from server callback');
    }

    console.log('code received:', !!code);
    console.log('Exchanging code for token...');

    try {
        const conn = new jsforce.Connection({ oauth2 });

        await conn.authorize(code);

        console.log('OAuth exchange successful');
        console.log('Access token received:', !!conn.accessToken);
        console.log('Instance URL received:', !!conn.instanceUrl);

        lcStorage.setItem('accessToken', conn.accessToken || '');
        lcStorage.setItem('instanceUrl', conn.instanceUrl || '');

        return res.redirect(APP_URL);
    } catch (err) {
        console.error('OAuth token exchange failed:', err.message);
        return res.status(500).send(`OAuth token exchange failed: ${err.message}`);
    }
};

// Function to get logged-in user details
const whoAmI = async (req, res) => {
    console.log("WHOAMI HIT");

    try {
        const instanceUrl = lcStorage.getItem('instanceUrl');
        const accessToken = lcStorage.getItem('accessToken');

        console.log("accessToken:", accessToken ? "exists" : "missing");
        console.log("instanceUrl:", instanceUrl ? "exists" : "missing");

        if (!accessToken || !instanceUrl) {
            return res.status(200).send({});
        }

        const conn = new jsforce.Connection({
            instanceUrl: instanceUrl,
            accessToken: accessToken
        });

        // 🔥 FORCE REQUEST (instead of identity helper)
        const response = await conn.request(`${instanceUrl}/services/oauth2/userinfo`);

        console.log("USER INFO RECEIVED");

        return res.json(response);

    } catch (error) {
        console.error("WHOAMI ERROR", error.message);

        lcStorage.clear();
        return res.status(200).send({});
    }
};

// Function to perform Salesforce logout and clear localstorage
const logout = (req, res) => {
    lcStorage.clear()
    res.redirect(`${APP_URL}/login`)
}

// Centralized error handler function
const handleSalesforceError = (error, res) => {
    if (error.statusCode === 404 && (error.code === 'NOT_FOUND' || error.errorCode === 'INVALID_SESSION_ID')) {
        lcStorage.clear()
        res.status(200).send({})
    } else {
        console.error("Error", error)
        res.status(500).send(error)
    }
}

module.exports = {
    login,
    callback,
    whoAmI,
    logout
};