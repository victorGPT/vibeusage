const { issueDeviceToken, signInWithPassword } = require('./vibescore-api');

async function issueDeviceTokenWithPassword({ baseUrl, email, password, deviceName }) {
  const accessToken = await signInWithPassword({ baseUrl, email, password });
  const issued = await issueDeviceToken({ baseUrl, accessToken, deviceName });
  return issued;
}

async function issueDeviceTokenWithAccessToken({ baseUrl, accessToken, deviceName }) {
  const issued = await issueDeviceToken({ baseUrl, accessToken, deviceName });
  return issued;
}

module.exports = {
  issueDeviceTokenWithPassword,
  issueDeviceTokenWithAccessToken
};
