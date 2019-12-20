const fetchUID = async (username) => {
  return JSON.parse(await (await fetch(`https://api.picarto.tv/v1/channel/name/${username}`)).text()).user_id;
}

export default fetchUID;