# Tobias
Simple pub/sub style client for the Slack Discovery API

## Install
`npm i tobias`

## Example 
![in action](https://user-images.githubusercontent.com/2018204/130978576-1dbf9f1a-1f8f-4f2c-b593-ea40c206e818.gif)
```js
const tobias = require('tobias');

const instance = new tobias({ 
  discoveryToken: process.env.SLACK_DISCOVERY_TOKEN, 
  logger: console, 
  pollingIntervalSec: 1 
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
```
