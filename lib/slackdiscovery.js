class SlackDiscovery {
  
  enum = {
    DISCOVERY_READ_TIMEOUT: .1,
  }

  constructor(slackWebClient) {
    this.slackWebClient = slackWebClient;
  }

  sleep = async (sec) => {
    return new Promise((resolve) => {
      setTimeout(resolve, sec * 1000);
    });
  }  

  tombStoneMessage = async (ts=null, channel=null, team=null, replaceWithText=null) => {
    return await this.slackWebClient.apiCall(
      "discovery.chat.tombstone",
      {
        ts, 
        channel, 
        team,
        ...(replaceWithText && {content: replaceWithText})
      }
    );
  }

  restoreMessage = async (ts=null, channel=null, team=null) => {
    return await this.slackWebClient.apiCall(
      "discovery.chat.restore",
      {
        ts, 
        channel, 
        team,
      }
    );
  }

  deleteMessage = async (ts=null, channel=null, team=null) => {
    return await this.slackWebClient.apiCall(
      "discovery.chat.delete",
      {
        ts, 
        channel, 
        team,
      }
    );
  }

  getRecentConvos = async (mergeParams = {}, results = []) => {
    const callWithParams = { limit: 1000, ...mergeParams },
      response = await this.slackWebClient.apiCall(
        "discovery.conversations.recent",
        callWithParams
      );
    results = results.concat(response.channels);
    if (response.channels.length && response.offset) {
      await this.sleep(this.enum.DISCOVERY_READ_TIMEOUT);
      return await getRecentConvos({ latest: response.offset }, results);
    }
    return results;
  };

  getAllConvos = async (mergeParams = {}, results = []) => {
    const callWithParams = { limit: 1000, ...mergeParams },
      response = await this.slackWebClient.apiCall(
        "discovery.conversations.list",
        callWithParams
      );
    results = results.concat(response.channels);
    if (response.channels.length && response.offset) {
      await this.sleep(this.enum.DISCOVERY_READ_TIMEOUT);
      return await getAllConvos({ offset: response.offset }, results);
    }
    return results;
  };

  // the paginator wouldn't work on this, due to nested cursor
  getAllTeams = async (mergeParams = {}, results = []) => {
    const callWithParams = { limit: 1000, ...mergeParams },
      response = await this.slackWebClient.apiCall(
        "discovery.enterprise.info",
        callWithParams
      );
    results = results.concat(response.enterprise.teams);
    if (response.teams && response.teams.length && response.response_metadata.next_cursor) {
      await this.sleep(this.enum.DISCOVERY_READ_TIMEOUT);
      return await getAllTeams({cursor: response.response_metadata.next_cursor, results});
    }
    return results;
  };

  getConvoMessages = async (mergeParams = {}, ascending = true, results = []) => {
    const callWithParams = { limit: 1000, ...mergeParams },
      response = await this.slackWebClient.apiCall(
        "discovery.conversations.history",
        callWithParams
      );
    results = results.concat(response.messages);
    if (response.messages.length && response.offset) {
      await this.sleep(this.enum.DISCOVERY_READ_TIMEOUT);
      return await getConvoMessages({ latest: response.offset }, results);
    }
    return ascending ? results.reverse() : results;
  };
}

module.exports = SlackDiscovery;
