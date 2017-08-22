'use strict';
const HTMLParser = require('fast-html-parser');
const TokenProvider = require('refresh-token');
const bleach = require('bleach');
const esi = require('eve-swagger');
const parseString = require('xml2js').parseString;
const q = require('q');
const rp = require('request-promise');


module.exports = getBBMotd;

/**
 * Fetches the BB motd from ESI with the given credentials and enriches
 * it with details from zkillboard as well as XML api
 *
 * @param config
 * @returns {Promise.<{text: Array<String>, upcomingFleets: Array<String>, kills: {totalValue: Number, shipTypeID: Number, victim: String}}>}
 */
function getBBMotd(config) {
	// handles token refreshing and such (less headache)
	const tokenProvider = new TokenProvider('https://login.eveonline.com/oauth/token', {
		refresh_token: config.refreshToken,
		client_id: config.clientID,
		client_secret: config.clientSecret
	});

	return q.ninvoke(tokenProvider, 'getToken')
		.then(token => {
			let esi2 = esi({
				service: 'https://esi.tech.ccp.is',
				source: 'tranquility',
				agent: 'bombers bar motd reader',
				language: 'en-us',
				timeout: 6000,
				minTime: 0,
				maxConcurrent: 0
			});
			return esi2.characters(config.characterID, token).chatChannels();
		})
		// find the BB channel
		.then(channels => {
			return channels.find(c => {
				return c.channel_id === -84353881;
			});
		})
		// parse motd info
		.then(channel => {

			let motd = parseChannelMotd(channel);

			let kills = motd.killIds.map(k => getKillmailDetails(k));
			kills.sort(function (a, b) {
				return a.totalValue - b.totalValue;
			});

			return q.all(kills)
				.then(kills => {
					motd.sortedKills = kills;
					return motd;
				});
		})
}


/**
 * Fetches the killmail details for a killID from zkill as well as the XML api
 *
 * @param killID
 * @returns {Promise.<{totalValue: Number, shipTypeID: Number, victim: String}>}
 */
function getKillmailDetails(killID) {

	return rp("https://zkillboard.com/api/killID/" + killID + "/").then(data => {
			const json = JSON.parse(data);
			return {
				totalValue: json[0].zkb.totalValue,
				shipTypeID: json[0].victim.shipTypeID,
				victim: json[0].victim.characterName,
			};

		})
		.then(data => {
			return rp("https://api.eveonline.com/eve/TypeName.xml.aspx?ids=" + data.shipTypeID)
				.then(xml => {
					return q.nfcall(parseString, xml);
				})
				.then(result => {
					const ship = result.eveapi.result[0].rowset[0].row[0].$.typeName;
					return {
						ship: ship,
						totalValue: data.totalValue,
						victim: data.victim,
						killID: killID,
						shipTypeID: data.shipTypeID
					};
				});
		})
}

/**
 * Parses a BB channel object from ESI
 *
 * @param channel
 * @returns {{text: Array, upcomingFleets: Array, killIds: Array}}
 */
function parseChannelMotd(channel) {

	let html = bleach.sanitize(channel.motd, {
		mode: 'white',
		list: ['url', 'color', 'br', 'b']
	});

	let root = HTMLParser.parse(html);
	let text = root.structuredText.split('\n');
	let links = root.querySelectorAll('url');
	let colors = root.querySelectorAll('color');

	// parse announced fleets
	let upcomingFleets;
	for (let color of colors) {
		if (color.rawAttrs === "=0xffffffff" && color.text.substring(0, 1) === "*") {
			upcomingFleets = color.text
				.split("*")
				.map(s => s.trim())
				.filter(s => !!s)
		}
	}

	// parse kill-links
	let killIdPattern = /=killReport:([0-9]+):[0-9a-f]+/;
	let killIds = [];
	for (let link of links) {
		let match = killIdPattern.exec(link.rawAttrs);
		if (match) {
			let killID = match[1];
			killIds.push(killID);
		}
	}

	return {
		text,
		upcomingFleets,
		killIds
	};
}