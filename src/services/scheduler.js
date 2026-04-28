const { expireAgreements, sendExpiryWarnings } = require('./expiry');

let expiryInterval  = null;
let warningInterval = null;

const startScheduler = () => {
  console.log('Scheduler started');
  expiryInterval  = setInterval(async () => { await expireAgreements(); }, 60 * 1000);
  warningInterval = setInterval(async () => { await sendExpiryWarnings(); }, 2 * 60 * 1000);
  expireAgreements();
  sendExpiryWarnings();
};

const stopScheduler = () => {
  if (expiryInterval)  clearInterval(expiryInterval);
  if (warningInterval) clearInterval(warningInterval);
  console.log('Scheduler stopped');
};

module.exports = { startScheduler, stopScheduler };
