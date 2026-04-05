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

// Function to Create Connection 
const createConnection = () => {
    let instanceUrl = lcStorage.getItem('instanceUrl')
    let accessToken = lcStorage.getItem('accessToken')

    if (!accessToken || !instanceUrl) {
        return null
    }

    return new jsforce.Connection({
        accessToken,
        instanceUrl
    })
}

// Function to get logged-in user details
const whoAmI = async (req, res) => {
    try {
        const conn = createConnection()

        if (!conn) {
            return res.status(200).send({});
        }

        const response = await conn.request(`${conn.instanceUrl}/services/oauth2/userinfo`);
        return res.json(response);
    } catch (error) {
        console.error('WHOAMI ERROR', error.message);
        lcStorage.clear();
        return res.status(200).send({});
    }
}

// Function to perform Salesforce logout and clear localstorage
const logout = (req, res) => {
    lcStorage.clear()
    res.redirect(`${APP_URL}/login`)
}

// Function to get Expenses from Salesforce
const getExpenses = async (req, res) => {

    try {
        const conn = createConnection()

        if (!conn) {
            return res.status(200).send({});
        }

        const result = await conn.query(
            "SELECT Id, Amount__c, Category__c, Date__c, Name, Expense_Name__c, Notes__c FROM Expense__c ORDER BY Date__c DESC"
        )

        return res.json(result)
    } catch (error) {
        console.error('GET EXPENSES ERROR', error)
        return handleSalesforceError(error, res)
    }
}

// Function to Create Expenses in Salesforce
const createExpense = async (req, res) => {
    try {
        const conn = createConnection();

        if (!conn) {
            return res.status(200).send({})
        }

        const {
            Expense_Name__c,
            Amount__c,
            Date__c,
            Category__c,
            Notes__c
        } = req.body

        const result = await conn.sobject('Expense__c').create({
            Expense_Name__c,
            Amount__c,
            Date__c,
            Category__c,
            Notes__c
        })

        return res.json(result)
    } catch (error) {
        console.error('CREATE EXPENSE ERROR:', error)
        return handleSalesforceError(error, res)
    }
}

// Function to Update Expenses in Salesforce
const updateExpense = async (req, res) => {
    try {
        const conn = createConnection()

        if (!conn) {
            return res.status(200).send({})
        }

        const {id} = req.params
        const {
            Expense_Name__c,
            Amount__c,
            Date__c,
            Category__c,
            Notes__c
        } = req.body

        const result = await conn.sobject('Expense__c').update({
            Id:id,
            Expense_Name__c,
            Amount__c,
            Date__c,
            Category__c,
            Notes__c
        })

        return res.json(result)
    } catch (error) {
        console.error('UPDATE EXPENSE ERROR:', error)
        return handleSalesforceError(error, res)
    }
}

// Function to Update Expenses in Salesforce
const deleteExpense = async (req, res) => {
    try {
        const conn = createConnection()

        if (!conn) {
            return res.status(200).send({})
        }

        const {id} = req.params
        const result = await conn.sobject('Expense__c').destroy(id)

        return res.json(result)
    } catch (error) {
        console.error('CREATE EXPENSE ERROR:', error)
        return handleSalesforceError(error, res)
    }
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
    logout,
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense
};