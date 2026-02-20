require('dotenv').config();
const { sendConfirmationEmail } = require("../services/emailService");

sendConfirmationEmail(process.env.TEST_EMAIL, "1234")
