const express = require('express')
const router = express.Router()
const salesforceService = require('../services/salesforceService')

// Expense routes
router.get('/', salesforceService.getExpenses)

module.exports = router