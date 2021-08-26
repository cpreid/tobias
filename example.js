const Tobias = require('./index');

const instance = new Tobias({ 
  discoveryToken: process.env.SLACK_DISCOVERY_TOKEN, 
  logger: console, 
  pollingIntervalSec: 2.1 
});

instance.on("message", ({ message, channelId, slackDiscoveryClient }) => {
  console.log("\tChannel %s Message: %s", channelId, message.text);
  if (message.text.includes('pizza')) {
    slackDiscoveryClient.tombStoneMessage(
      ts = message.ts,
      channel = channelId,
      team = message.team,
      replaceWithText = 'Please refrain from discussing :pizza:');
  }
});
