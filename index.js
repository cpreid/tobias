const util = require("./lib/util");
const { WebClient } = require("@slack/web-api");
const SlackDiscovery = require("./lib/slackdiscovery");
const events = require("events");

const ENUM = {
  DEFAULT_POLLING_INTERVAL: 3,
  PROCESSEDMSGSMAXLENGTH: 10000,
}

class SlackDiscoveryListener {

  /**
   * Used to store boundaries for Slack Discovery API calls
   * This can be referred to as Data Collection Window or DCW for documentation purposes
   */  
  dataCollectionTimeBounds = {}

  /**
   * This is a basic in-memory cache of alread-processed messages
   * This is to address a known design "issue" in the Discovery API where
   * timestamp windows used for conv.recent & conv.history are not aligned
   * which has been observed to result in processing a message multiple times
   */  
  processedMsgs = []

  constructor({ discoveryToken, logger, pollingIntervalSec }) {
    if (!discoveryToken) {
      throw new util.SlackDiscoveryTokenMissing('please provide a token');
    }
    this.slackDiscoveryClient = new SlackDiscovery(new WebClient(discoveryToken))
    this.customLogger = logger || null;
    this.customPollingIntervalSec = pollingIntervalSec || ENUM.DEFAULT_POLLING_INTERVAL;
    this.emitter = new events.EventEmitter();

    /**
     * Enforce a max length of processedMsgs Array
     * By defining a method that handles it like a fifo queue
     * So it doesn't grow indefinitely and cause memory issues
     */
    this.processedMsgs.add = function () {
      if (this.length === ENUM.PROCESSEDMSGSMAXLENGTH) this.shift();
      this.push.apply(this, arguments);
    }

    // begin polling slack discovery api
    this.poll();
  }

  isMessageProcessable = (channelId, msgTS) => {
    return !this.processedMsgs.includes(`${channelId}-${msgTS}`);
  }

  messageMarkProcessed = (channelId, msgTS) => {
    return this.processedMsgs.add(`${channelId}-${msgTS}`);
  }

  on = async (...args) => {
    this.emitter.on.apply(this.emitter, args);
  }

  poll = async () => {
    // This is an N+1 number run. We want to peak back to activity that occurred at the end of the last time window
    // Our message processing logic will prevent dupe messages from potentially begin processed if they are 
    // at the end of DCW A and the beginning of DCW B
    if (this.dataCollectionTimeBounds.lastRun) {
      this.customLogger && this.customLogger.debug("Ongoing run...");
      this.dataCollectionTimeBounds.latest = parseInt(Number(this.dataCollectionTimeBounds.lastRun) / 1000);
    }
    else {
      this.customLogger && this.customLogger.debug("First run...");
      const threeAgo = new Date;
      threeAgo.setSeconds(threeAgo.getSeconds() - 3);
      this.dataCollectionTimeBounds.latest = parseInt(Number(threeAgo) / 1000);
    }

    this.customLogger && this.customLogger.debug("DCW since %d", this.dataCollectionTimeBounds.latest);

    /**
     * Get all recent conversations in Grid
     * this includes all types (dm, mpdm, mws, pub, priv)
     */
    const activeConvo = await this.slackDiscoveryClient.getRecentConvos(
      /* For `discovery.conversations.recent`, think of latest as "since time"*/
      { latest: this.dataCollectionTimeBounds.latest });

    this.customLogger && this.customLogger.info("Active convos: %d. {latest: %s}", activeConvo.length, this.dataCollectionTimeBounds.latest);

    for (let r = 0; r < activeConvo.length; r++) {
      /**
       * Consider awaiting this to avoid hittin "global" rate limit thresholds
       * Specifically, `discovery.conversations.recent` + `discovery.conversations.history`
       */
      this.processActiveConvo(activeConvo[r]);
    }

    this.dataCollectionTimeBounds.lastRun = new Date;

    await util.sleep(this.customPollingIntervalSec);
    this.poll();

  }

  /**
   * This method takes a convo that was detected via `discovery.conversations.recent`
   * And chains to `discovery.conversations.history` to collect all recent messages in the conversation 
   * and applies processing logic if a given message has not yet been processed according to our cache
   * @param {Object} recentConvo 
   */
  processActiveConvo = async (recentConvo) => {
    const callWithParams = {
      channel: recentConvo.id,
      // conv.history & conv.recent are inverse
      // This of `oldest` as "since"
      oldest: this.dataCollectionTimeBounds.latest,
    };

    /**
     * a) if it's a grid-level convo, the team ID is the Enterprise ID
     * b) if it's a workspace-level convo, the team ID is the workspace ID
     */
    if (!recentConvo.team.match(/^E/)) callWithParams.team = recentConvo.team;

    let recentMessages;
    try {
      recentMessages = await this.slackDiscoveryClient.getConvoMessages(callWithParams);
    } catch (err) {
      // this occurs when there is timestamp misalignment between disc.conv.recent & disc.conv.history
      this.customLogger && this.customLogger.error("Error: discovery.conversations.history for %s %s", callWithParams, String(err));
      return;
    }

    /**
    * Recent messages may contain already-processed messages. Filter out processed messages
    */
    recentMessages = recentMessages.filter(msg => { return this.isMessageProcessable(recentConvo.id, msg.ts) });

    this.customLogger && this.customLogger.info("Recent messages: %s", recentMessages.length);

    // Emit events to our message processors
    recentMessages.forEach((message) => {
      this.messageMarkProcessed(recentConvo.id, message.ts);
      this.emitter.emit("message", { message, channelId: recentConvo.id, slackDiscoveryClient: this.slackDiscoveryClient });
    });

  }
}

module.exports = SlackDiscoveryListener;