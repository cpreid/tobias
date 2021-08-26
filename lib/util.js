module.exports.sleep = (sec) => {
  return new Promise((resolve) => {
    setTimeout(resolve, sec * 1000);
  });
}

/**
 * Identifies what type of convo it is
 * @param {Object} convo 
 */
module.exports.identifyConvoType = convo => {
  let types = ["is_ext_shared", "is_private", "is_mpim", "is_dm", "is_deleted", "is_archived", "is_general", "is_im"];
  types = types.filter(type => {
    return convo[type] === true;
  })
  if(!types.includes('is_private')) types.push('is_public');
  return types;
}


module.exports.SlackDiscoveryTokenMissing = class SlackDiscoveryTokenMissing extends Error {}

