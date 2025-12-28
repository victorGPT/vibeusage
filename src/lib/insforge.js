const { exchangeLinkCode, issueDeviceToken, signInWithPassword } = require('./vibescore-api');

async function issueDeviceTokenWithPassword({ baseUrl, email, password, deviceName }) {
  const accessToken = await signInWithPassword({ baseUrl, email, password });
  const issued = await issueDeviceToken({ baseUrl, accessToken, deviceName });
  return issued;
}

async function issueDeviceTokenWithAccessToken({ baseUrl, accessToken, deviceName }) {
  const issued = await issueDeviceToken({ baseUrl, accessToken, deviceName });
  return issued;
}

async function issueDeviceTokenWithLinkCode({ baseUrl, linkCode, requestId, deviceName, platform }) {
  const issued = await exchangeLinkCode({ baseUrl, linkCode, requestId, deviceName, platform });
  return { token: issued.token, deviceId: issued.deviceId };
}

module.exports = {
  issueDeviceTokenWithPassword,
  issueDeviceTokenWithAccessToken,
  issueDeviceTokenWithLinkCode
};
