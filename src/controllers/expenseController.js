const express = require('express')
const router = express.Router()
const salesforceService = require('../services/salesforceService')

// Expense routes
router.get('/', salesforceService.getExpenses)
router.post('/', salesforceService.createExpense)
router.put('/:id', salesforceService.updateExpense)

module.exports = router