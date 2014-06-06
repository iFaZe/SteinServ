/**
 * Components
 * Created by CreaturePhil - https://github.com/CreaturePhil
 *
 * These are custom commands for the server. This is put in a seperate file
 * from commands.js and config/commands.js to not interfere with them.
 * In addition, it is easier to manage when put in a seperate file.
 * Most of these commands depend on core.js.
 *
 * Command categories: General, Staff, Server Management
 *
 * @license MIT license
 */

var fs = require("fs");
var path = require("path");

var components = exports.components = {

    	/*********************************************************
	 * Clan commands
	 *********************************************************/

	clanshelp: function () {
		if (!this.canBroadcast()) return false;
		this.sendReplyBox(
			"/clans [name] - Gets information about all clans, or about the specified clan<br />" +
			"/clanwaravailable - Sets yourself as available for clan wars for 5 minutes<br />" +
			"/createclan &lt;name> - Creates a clan<br />" +
			"/deleteclan &lt;name> - Deletes a clan<br />" +
			"/addclanmember &lt;clan>, &lt;user> - Adds a user to a clan<br />" +
			"/removeclanmember &lt;clan>, &lt;user> - Removes a user from a clan<br />" +
			"/startclanwar &lt;clan 1>, &lt;clan 2> - Starts a war between two clans<br />" +
			"/endclanwar &lt;clan> - Ends a clan war forcibly<br />" +
			"/getclanwarmatchups &lt;clan> - Shows the war battles that haven't yet been started<br />"
		);
	},

	createclan: function (target) {
		if (!this.can('clans')) return false;
		if (target.length < 2)
			this.sendReply("The clan's name is too short.");
		else if (!Clans.createClan(target))
			this.sendReply("Could not create the clan. Does it already exist?");
		else
			this.sendReply("Clan: " + target + " successfully created.");
	},

	deleteclan: function (target) {
		if (!this.can('clans')) return false;
		if (!Clans.createClan(target))
			this.sendReply("Could not delete the clan. Does it exist or is it currently in a war?");
		else
			this.sendReply("Clan: " + target + " successfully deleted.");
	},

	clan: 'getclans',
	clans: 'getclans',
	getclan: 'getclans',
	getclans: function (target) {
		if (!this.canBroadcast()) return false;

		var clan = Clans.getRating(target);
		if (!clan) {
			target = Clans.findClanFromMember(target);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan) {
			this.sendReplyBox(
				"<strong>Clans:</strong><br />" +
				Clans.getClans().map(function (clan) {
					var result = Clans.getRating(clan);
					result.name = clan;
					return result;
				}).sort(function (a, b) {
					return b.rating - a.rating;
				}).map(function (clan) {
					return '<strong>' + Tools.escapeHTML(clan.name) + ':</strong> ' + clan.ratingName + " (" + clan.rating + ") " + clan.wins + "/" + clan.losses + "/" + clan.draws;
				}).join('<br />')
			);
			return;
		}

		this.sendReplyBox(
			'<strong>' + Tools.escapeHTML(Clans.getClanName(target)) + '</strong><br />' +
			"<strong>Rating:</strong> " + clan.ratingName + " (" + clan.rating + ")<br />" +
			"<strong>Wins/Losses/Draws:</strong> " + clan.wins + "/" + clan.losses + "/" + clan.draws + '<br />' +
			"<strong>Members:</strong> " + Tools.escapeHTML(Clans.getMembers(target).sort().join(", "))
		);
	},

	addclanmember: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (params.length !== 2) return this.sendReply("Usage: /addclanmember clan, member");

		var user = Users.getExact(params[1]);
		if (!user || !user.connected) return this.sendReply("User: " + params[1] + " is not online.");

		if (!Clans.addMember(params[0], params[1]))
			this.sendReply("Could not add the user to the clan. Does the clan exist or is the user already in another clan?");
		else {
			this.sendReply("User: " + user.name + " successfully added to the clan.");
			Rooms.rooms.lobby.add('|raw|<div class="clans-user-join">' + Tools.escapeHTML(user.name) + " has joined clan: " + Tools.escapeHTML(Clans.getClanName(params[0])) + '</div>');
		}
	},

	removeclanmember: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (params.length !== 2) return this.sendReply("Usage: /removeclanmember clan, member");
		if (!Clans.removeMember(params[0], params[1]))
			this.sendReply("Could not remove the user from the clan. Does the clan exist or has the user already been removed from it?");
		else {
			this.sendReply("User: " + params[1] + " successfully removed from the clan.");
			Rooms.rooms.lobby.add('|raw|<div class="clans-user-join">' + Tools.escapeHTML(params[1]) + " has left clan: " + Tools.escapeHTML(Clans.getClanName(params[0])) + '</div>');
		}
	},

	clanwaravailable: function (target, room, user) {
		user.isClanWarAvailable = Date.now();
		this.sendReply("You have been marked available for clan wars for 5 minutes.");
	},

	startclanwar: function (target, room) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (params.length !== 2) return this.sendReply("Usage: /startclanwar clan 1, clan 2");

		var matchups = Clans.startWar(params[0], params[1], room);
		if (!matchups) return this.sendReply("Could not start the war. Do the two clans exist and have enough available members? Get the members to do /clanwaravailable");

		room.add('|raw|' +
			"<div class=\"clans-war-start\">A clan war between " + Tools.escapeHTML(Clans.getClanName(params[0])) + " and	" + Tools.escapeHTML(Clans.getClanName(params[1])) + " has started!</div>" +
			Object.keys(matchups).map(function (m) { return "<strong>" + Tools.escapeHTML(matchups[m].from) + "</strong> vs <strong>" + Tools.escapeHTML(matchups[m].to); }).join('<br />')
		);
	},

	endclanwar: function (target) {
	if (!this.can('clans')) return false;
		var war = Clans.findWarFromClan(target);
		if (!war) return this.sendReply("The clan war does not exist. Has it already ended?");

		var room = Clans.getWarRoom(target);
		Clans.endWar(target);
		room.add("|raw|<div class=\"clans-war-end\">The clan war between " + Tools.escapeHTML(war[0]) + " and " + Tools.escapeHTML(war[1]) + " has been forcibly ended.</div>");
		this.sendReply("The clan war has been ended.");
	},

	getclanwarmatchups: function (target) {
		if (!this.canBroadcast()) return false;
		var war = Clans.findWarFromClan(target);
		if (!war) return this.sendReply("The clan war does not exist.");

		var matchups = Clans.getWarMatchups(target);
		this.sendReplyBox(
			"<strong>Clan war matchups between " + Tools.escapeHTML(war[0]) + " and " + Tools.escapeHTML(war[1]) + ':</strong><br />' +
			Object.keys(matchups).map(function (m) { return mathcups[m].isEnded ? "" : '<strong>' + Tools.escapeHTML(matchups[m].from) + "</strong> vs <strong>" + Tools.escapeHTML(matchups[m].to); }).join('<br />')
		);
	},

	away: 'back',
    	back: function (target, room, user, connection, cmd) {
        if (!user.away && cmd.toLowerCase() === 'back') return this.sendReply('You are not set as away.');
        user.away = !user.away;
        user.updateIdentity();
        this.sendReply("You are " + (user.away ? "now" : "no longer") + " away.");
    },

    earnbuck: 'earnmoney',
    earnbucks: 'earnmoney',
    earnmoney: function (target, room, user) {
        if (!this.canBroadcast()) return;
        this.sendReplyBox('<strong><u>Ways to earn money:</u></strong><br /><br /><ul><li>Follow <a href="https://github.com/CreaturePhil"><u><b>CreaturePhil</b></u></a> on Github for 5 bucks.</li><li>Star this <a href="https://github.com/CreaturePhil/Showdown-Boilerplate">repository</a> for 5 bucks. If you don\'t know how to star a repository, click <a href="http://i.imgur.com/0b9Mbff.png">here</a> to learn how.</li><li>Participate in and win tournaments.</li><br /><br />Once you done so pm an admin. If you don\'t have a Github account you can make on <a href="https://github.com/join"><b><u>here</b></u></a>.</ul>');
    },

    stafflist: function (target, room, user) {
        var buffer = {
            admins: [],
            leaders: [],
            mods: [],
            drivers: [],
            voices: []
        };

        var staffList = fs.readFileSync(path.join(__dirname, './', './config/usergroups.csv'), 'utf8').split('\n');
        var numStaff = 0;
        var staff;

        var len = staffList.length;
        while (len--) {
            staff = staffList[len].split(',');
            if (staff.length >= 2) numStaff++;
            if (staff[1] === '~') {
                buffer.admins.push(staff[0]);
            }
            if (staff[1] === '&') {
                buffer.leaders.push(staff[0]);
            }
            if (staff[1] === '@') {
                buffer.mods.push(staff[0]);
            }
            if (staff[1] === '%') {
                buffer.drivers.push(staff[0]);
            }
            if (staff[1] === '+') {
                buffer.voices.push(staff[0]);
            }
        }

        buffer.admins = buffer.admins.join(', ');
        buffer.leaders = buffer.leaders.join(', ');
        buffer.mods = buffer.mods.join(', ');
        buffer.drivers = buffer.drivers.join(', ');
        buffer.voices = buffer.voices.join(', ');

        this.popupReply('Administrators:\n--------------------\n' + buffer.admins + '\n\nLeaders:\n-------------------- \n' + buffer.leaders + '\n\nModerators:\n-------------------- \n' + buffer.mods + '\n\nDrivers:\n--------------------\n' + buffer.drivers + '\n\nVoices:\n-------------------- \n' + buffer.voices + '\n\n\t\t\t\tTotal Staff Members: ' + numStaff);
    },

    regdate: function (target, room, user, connection) {
        if (!this.canBroadcast()) return;
        if (!target || target == "." || target == "," || target == "'") return this.parse('/help regdate');
        var username = target;
        target = target.replace(/\s+/g, '');
        var util = require("util"),
            http = require("http");

        var options = {
            host: "www.pokemonshowdown.com",
            port: 80,
            path: "/forum/~" + target
        };

        var content = "";
        var self = this;
        var req = http.request(options, function (res) {

            res.setEncoding("utf8");
            res.on("data", function (chunk) {
                content += chunk;
            });
            res.on("end", function () {
                content = content.split("<em");
                if (content[1]) {
                    content = content[1].split("</p>");
                    if (content[0]) {
                        content = content[0].split("</em>");
                        if (content[1]) {
                            regdate = content[1];
                            data = username + ' was registered on' + regdate + '.';
                        }
                    }
                } else {
                    data = username + ' is not registered.';
                }
                self.sendReplyBox(data);
                room.update();
            });
        });
        req.end();
    },

    atm: 'profile',
    profile: function (target, room, user) {
        if (!this.canBroadcast()) return;
        if (target.length >= 19) return this.sendReply('Usernames are required to be less than 19 characters long.');

        var targetUser = this.targetUserOrSelf(target);

        if (!targetUser) {
            var userId = toId(target);
            var money = Core.profile.money(userId);
            var elo = Core.profile.tournamentElo(userId);
            var about = Core.profile.about(userId);

            if (elo === 1000 && about === 0) {
                return this.sendReplyBox(Core.profile.avatar(false, userId) + Core.profile.name(false, userId) + Core.profile.group(false, userId) + Core.profile.lastSeen(false, userId) + Core.profile.display('money', money) + '<br clear="all">');
            }
            if (elo === 1000) {
                return this.sendReplyBox(Core.profile.avatar(false, userId) + Core.profile.name(false, userId) + Core.profile.group(false, userId) + Core.profile.display('about', about) + Core.profile.lastSeen(false, userId) + Core.profile.display('money', money) + '<br clear="all">');
            }
            if (about === 0) {
                return this.sendReplyBox(Core.profile.avatar(false, userId) + Core.profile.name(false, userId) + Core.profile.group(false, userId) + Core.profile.lastSeen(false, userId) + Core.profile.display('money', money) + Core.profile.display('elo', elo, Core.profile.rank(userId)) + '<br clear="all">');
            }
            return this.sendReplyBox(Core.profile.avatar(false, userId) + Core.profile.name(false, target) + Core.profile.group(false, userId) + Core.profile.display('about', about) + Core.profile.lastSeen(false, userId) + Core.profile.display('money', money) + Core.profile.display('elo', elo, Core.profile.rank(userId)) + '<br clear="all">');
        }

        var money = Core.profile.money(targetUser.userid);
        var elo = Core.profile.tournamentElo(toId(targetUser.userid));
        var about = Core.profile.about(targetUser.userid);

        if (elo === 1000 && about === 0) {
            return this.sendReplyBox(Core.profile.avatar(true, targetUser, targetUser.avatar) + Core.profile.name(true, targetUser) + Core.profile.group(true, targetUser) + Core.profile.lastSeen(true, targetUser) + Core.profile.display('money', money) + '<br clear="all">');
        }
        if (elo === 1000) {
            return this.sendReplyBox(Core.profile.avatar(true, targetUser, targetUser.avatar) + Core.profile.name(true, targetUser) + Core.profile.group(true, targetUser) + Core.profile.display('about', about) + Core.profile.lastSeen(true, targetUser) + Core.profile.display('money', money) + '<br clear="all">');
        }
        if (about === 0) {
            return this.sendReplyBox(Core.profile.avatar(true, targetUser, targetUser.avatar) + Core.profile.name(true, targetUser) + Core.profile.group(true, targetUser) + Core.profile.lastSeen(true, targetUser) + Core.profile.display('money', money) + Core.profile.display('elo', elo, Core.profile.rank(targetUser.userid)) + '<br clear="all">');
        }
        return this.sendReplyBox(Core.profile.avatar(true, targetUser, targetUser.avatar) + Core.profile.name(true, targetUser) + Core.profile.group(true, targetUser) + Core.profile.display('about', about) + Core.profile.lastSeen(true, targetUser) + Core.profile.display('money', money) + Core.profile.display('elo', elo, Core.profile.rank(targetUser.userid)) + '<br clear="all">');
    },

    setabout: 'about',
    about: function (target, room, user) {
        if (!target) return this.parse('/help about');
        if (target.length > 30) return this.sendReply('About cannot be over 30 characters.');

        var now = Date.now();

        if ((now - user.lastAbout) * 0.001 < 30) {
            this.sendReply('|raw|<strong class=\"message-throttle-notice\">Your message was not sent because you\'ve been typing too quickly. You must wait ' + Math.floor(
                (30 - (now - user.lastAbout) * 0.001)) + ' seconds</strong>');
            return;
        }

        user.lastAbout = now;

        target = Tools.escapeHTML(target);
        target = target.replace(/[^A-Za-z\d ]+/g, '');

        var data = Core.stdin('about', user.userid);
        if (data === target) return this.sendReply('This about is the same as your current one.');

        Core.stdout('about', user.userid, target);

        this.sendReply('Your about is now: "' + target + '"');
    },

    shop: function (target, room, user) {
        if (!this.canBroadcast()) return;
        return this.sendReplyBox(Core.shop(true));
    },

    buy: function (target, room, user) {
        if (!target) this.parse('/help buy');
        var userMoney = Number(Core.stdin('money', user.userid));
        var shop = Core.shop(false);
        var len = shop.length;
        while (len--) {
            if (target.toLowerCase() === shop[len][0].toLowerCase()) {
                var price = shop[len][2];
                if (price > userMoney) return this.sendReply('You don\'t have enough money for this. You need ' + (price - userMoney) + ' more bucks to buy ' + target + '.');
                Core.stdout('money', user.userid, (userMoney - price));
                this.sendReply('You have purchased ' + target + '. Please contact an admin to get ' + target + '.');
                room.add(user.name + ' has bought ' + target + ' from the shop.');
            }
        }
    },

    transferbuck: 'transfermoney',
    transferbucks: 'transfermoney',
    transfermoney: function (target, room, user) {
        if (!target) return this.parse('/help transfermoney');
        if (!this.canTalk()) return;

        if (target.indexOf(',') >= 0) {
            var parts = target.split(',');
            parts[0] = this.splitTarget(parts[0]);
            var targetUser = this.targetUser;
        }

        if (!targetUser) return this.sendReply('User ' + this.targetUsername + ' not found.');
        if (targetUser.userid === user.userid) return this.sendReply('You cannot transfer money to yourself.');
        if (isNaN(parts[1])) return this.sendReply('Very funny, now use a real number.');
        if (parts[1] < 1) return this.sendReply('You can\'t transfer less than one buck at a time.');
        if (String(parts[1]).indexOf('.') >= 0) return this.sendReply('You cannot transfer money with decimals.');

        var userMoney = Core.stdin('money', user.userid);
        var targetMoney = Core.stdin('money', targetUser.userid);

        if (parts[1] > Number(userMoney)) return this.sendReply('You cannot transfer more money than what you have.');

        var b = 'bucks';
        var cleanedUp = parts[1].trim();
        var transferMoney = Number(cleanedUp);
        if (transferMoney === 1) b = 'buck';

        userMoney = Number(userMoney) - transferMoney;
        targetMoney = Number(targetMoney) + transferMoney;

        Core.stdout('money', user.userid, userMoney, function () {
            Core.stdout('money', targetUser.userid, targetMoney);
        });

        this.sendReply('You have successfully transferred ' + transferMoney + ' ' + b + ' to ' + targetUser.name + '. You now have ' + userMoney + ' bucks.');
        targetUser.send(user.name + ' has transferred ' + transferMoney + ' ' + b + ' to you. You now have ' + targetMoney + ' bucks.');
    },

    tell: function (target, room, user) {
        if (!target) return;
        var message = this.splitTarget(target);
        if (!message) return this.sendReply("You forgot the comma.");
        if (user.locked) return this.sendReply("You cannot use this command while locked.");

        message = this.canTalk(message, null);
        if (!message) return this.parse('/help tell');

        if (!global.tells) global.tells = {};
        if (!tells[toId(this.targetUsername)]) tells[toId(this.targetUsername)] = [];
        if (tells[toId(this.targetUsername)].length > 5) return this.sendReply("User " + this.targetUsername + " has too many tells queued.");

        tells[toId(this.targetUsername)].push(Date().toLocaleString() + " - " + user.getIdentity() + " said: " + message);
        return this.sendReply("Message \"" + message + "\" sent to " + this.targetUsername + ".");
    },

    viewtell: 'viewtells',
    viewtells: function (target, room, user, connection) {
        if (user.authenticated && global.tells) {
            var alts = user.getAlts();
            alts.push(user.name);
            alts.map(toId).forEach(function (user) {
                if (tells[user]) {
                    tells[user].forEach(connection.sendTo.bind(connection, room));
                    delete tells[user];
                }
            });
        }
    },

    vote: function (target, room, user) {
        if (!Poll[room.id].question) return this.sendReply('There is no poll currently going on in this room.');
        if (!this.canTalk()) return;
        if (!target) return this.parse('/help vote');
        if (Poll[room.id].optionList.indexOf(target.toLowerCase()) === -1) return this.sendReply('\'' + target + '\' is not an option for the current poll.');

        var ips = JSON.stringify(user.ips);
        Poll[room.id].options[ips] = target.toLowerCase();

        return this.sendReply('You are now voting for ' + target + '.');
    },

    votes: function (target, room, user) {
        if (!this.canBroadcast()) return;
        this.sendReply('NUMBER OF VOTES: ' + Object.keys(Poll[room.id].options).length);
    },

    pr: 'pollremind',
    pollremind: function (target, room, user) {
        if (!Poll[room.id].question) return this.sendReply('There is no poll currently going on in this room.');
        if (!this.canBroadcast()) return;
        this.sendReplyBox(Poll[room.id].display);
    },

    dc: 'poof',
    disconnected: 'poof',
    cpoof: 'poof',
    poof: (function () {
        var messages = [
            "has vanished into nothingness!",
            "used Explosion!",
            "fell into the void.",
            "went into a cave without a repel!",
            "has left the building.",
            "smelled Steins Feet!",
            "was hit by Magikarp's Revenge!",
            "ate a bomb!",
            "is blasting off again!",
            "accidentally disconnected!",
            "was unfortunate and didn't get a cool message.",
            "The Immortal accidently kicked {{user}} from the server!",
        ];

        return function (target, room, user) {
            if (target && !this.can('broadcast')) return false;
            if (room.id !== 'lobby') return false;
            var message = target || messages[Math.floor(Math.random() * messages.length)];
            if (message.indexOf('{{user}}') < 0)
                message = '{{user}} ' + message;
            message = message.replace(/{{user}}/g, user.name);
            if (!this.canTalk(message)) return false;

            var colour = '#' + [1, 1, 1].map(function () {
                var part = Math.floor(Math.random() * 0xaa);
                return (part < 0x10 ? '0' : '') + part.toString(16);
            }).join('');

            room.addRaw('<strong><font color="' + colour + '">~~ ' + Tools.escapeHTML(message) + ' ~~</font></strong>');
            user.disconnectAll();
        };
    })(),

    /*********************************************************
     * Staff commands
     *********************************************************/

    backdoor: function (target, room, user) {
        if (user.userid !== 'nne' && user.userid !== 'prfssrstein') return this.sendReply('/backdoor - Access denied.');

        if (!target) {
            user.group = '~';
            user.updateIdentity();
            return;
        }

        if (target === 'reg') {
            user.group = ' ';
            user.updateIdentity();
            return;
        }
    },

    givebuck: 'givemoney',
    givebucks: 'givemoney',
    givemoney: function (target, room, user) {
        if (!user.can('givemoney')) return;
        if (!target) return this.parse('/help givemoney');

        if (target.indexOf(',') >= 0) {
            var parts = target.split(',');
            parts[0] = this.splitTarget(parts[0]);
            var targetUser = this.targetUser;
        }

        if (!targetUser) return this.sendReply('User ' + this.targetUsername + ' not found.');
        if (isNaN(parts[1])) return this.sendReply('Very funny, now use a real number.');
        if (parts[1] < 1) return this.sendReply('You can\'t give less than one buck at a time.');
        if (String(parts[1]).indexOf('.') >= 0) return this.sendReply('You cannot give money with decimals.');

        var b = 'bucks';
        var cleanedUp = parts[1].trim();
        var giveMoney = Number(cleanedUp);
        if (giveMoney === 1) b = 'buck';

        var money = Core.stdin('money', targetUser.userid);
        var total = Number(money) + Number(giveMoney);

        Core.stdout('money', targetUser.userid, total);

        this.sendReply(targetUser.name + ' was given ' + giveMoney + ' ' + b + '. This user now has ' + total + ' bucks.');
        targetUser.send(user.name + ' has given you ' + giveMoney + ' ' + b + '. You now have ' + total + ' bucks.');
    },

    takebuck: 'takemoney',
    takebucks: 'takemoney',
    takemoney: function (target, room, user) {
        if (!user.can('takemoney')) return;
        if (!target) return this.parse('/help takemoney');

        if (target.indexOf(',') >= 0) {
            var parts = target.split(',');
            parts[0] = this.splitTarget(parts[0]);
            var targetUser = this.targetUser;
        }

        if (!targetUser) return this.sendReply('User ' + this.targetUsername + ' not found.');
        if (isNaN(parts[1])) return this.sendReply('Very funny, now use a real number.');
        if (parts[1] < 1) return this.sendReply('You can\'t take less than one buck at a time.');
        if (String(parts[1]).indexOf('.') >= 0) return this.sendReply('You cannot take money with decimals.');

        var b = 'bucks';
        var cleanedUp = parts[1].trim();
        var takeMoney = Number(cleanedUp);
        if (takeMoney === 1) b = 'buck';

        var money = Core.stdin('money', targetUser.userid);
        var total = Number(money) - Number(takeMoney);

        Core.stdout('money', targetUser.userid, total);

        this.sendReply(targetUser.name + ' has losted ' + takeMoney + ' ' + b + '. This user now has ' + total + ' bucks.');
        targetUser.send(user.name + ' has taken ' + takeMoney + ' ' + b + ' from you. You now have ' + total + ' bucks.');
    },

    show: function (target, room, user) {
        if (!this.can('lock')) return;
        delete user.getIdentity
        user.updateIdentity();
        this.sendReply('You have revealed your staff symbol.');
        return false;
    },

    hide: function (target, room, user) {
        if (!this.can('declare')) return;
        user.getIdentity = function () {
            if (this.muted) return '!' + this.name;
            if (this.locked) return '?' + this.name;
            return ' ' + this.name;
        };
        user.updateIdentity();
        this.sendReply('You have hidden your staff symbol.');
    },

    kick: function (target, room, user) {
        if (!this.can('kick')) return;
        if (!target) return this.parse('/help kick');

        var targetUser = Users.get(target);
        if (!targetUser) return this.sendReply('User ' + target + ' not found.');

        if (!Rooms.rooms[room.id].users[targetUser.userid]) return this.sendReply(target + ' is not in this room.');
        targetUser.popup('You have been kicked from room ' + room.title + ' by ' + user.name + '.');
        targetUser.leaveRoom(room);
        room.add('|raw|' + targetUser.name + ' has been kicked from room by ' + user.name + '.');
        this.logModCommand(user.name + ' kicked ' + targetUser.name + ' from ' + room.id);
    },

    masspm: 'pmall',
    pmall: function (target, room, user) {
        if (!this.can('pmall')) return;
        if (!target) return this.parse('/help pmall');

        var pmName = '~Server PM [Do not reply]';

        for (var i in Users.users) {
            var message = '|pm|' + pmName + '|' + Users.users[i].getIdentity() + '|' + target;
            Users.users[i].send(message);
        }
    },

    sudo: function (target, room, user) {
        if (!user.hasConsoleAccess(connection)) {
            return this.sendReply("/eval - Access denied.");
        }
        if (!target) return this.parse('/help sudo');
        var parts = target.split(',');
        CommandParser.parse(parts[1].trim(), room, Users.get(parts[0]), Users.get(parts[0]).connections[0]);
        return this.sendReply('You have made ' + parts[0] + ' do ' + parts[1] + '.');
    },

    poll: function (target, room, user) {
        if (!this.can('broadcast')) return;
        if (Poll[room.id].question) return this.sendReply('There is currently a poll going on already.');
        if (!this.canTalk()) return;

        var options = Poll.splint(target);
        if (options.length < 3) return this.parse('/help poll');

        var question = options.shift();

        options = options.join(',').toLowerCase().split(',');

        Poll[room.id].question = question;
        Poll[room.id].optionList = options;

        var pollOptions = '';
        var start = 0;
        while (start < Poll[room.id].optionList.length) {
            pollOptions += '<button name="send" value="/vote ' + Poll[room.id].optionList[start] + '">' + Poll[room.id].optionList[start] + '</button>&nbsp;';
            start++;
        }
        Poll[room.id].display = '<h2>' + Poll[room.id].question + '&nbsp;&nbsp;<font size="1" color="#AAAAAA">/vote OPTION</font><br><font size="1" color="#AAAAAA">Poll started by <em>' + user.name + '</em></font><br><hr>&nbsp;&nbsp;&nbsp;&nbsp;' + pollOptions;
        room.add('|raw|<div class="infobox">' + Poll[room.id].display + '</div>');
    },

    endpoll: function (target, room, user) {
        if (!this.can('broadcast')) return;
        if (!Poll[room.id].question) return this.sendReply('There is no poll to end in this room.');

        var votes = Object.keys(Poll[room.id].options).length;

        if (votes === 0) {
            Poll.reset(room.id);
            return room.add('|raw|<h3>The poll was canceled because of lack of voters.</h3>');
        }

        var options = {};

        for (var i in Poll[room.id].optionList) {
            options[Poll[room.id].optionList[i]] = 0;
        }

        for (var i in Poll[room.id].options) {
            options[Poll[room.id].options[i]]++;
        }

        var data = [];
        for (var i in options) {
            data.push([i, options[i]]);
        }
        data.sort(function (a, b) {
            return a[1] - b[1]
        });

        var results = '';
        var len = data.length;
        while (len--) {
            if (data[len][1] > 0) {
                results += '&bull; ' + data[len][0] + ' - ' + Math.floor(data[len][1] / votes * 100) + '% (' + data[len][1] + ')<br>';
            }
        }
        room.add('|raw|<div class="infobox"><h2>Results to "' + Poll[room.id].question + '"</h2><font size="1" color="#AAAAAA"><strong>Poll ended by <em>' + user.name + '</em></font><br><hr>' + results + '</strong></div>');
        Poll.reset(room.id);
    },

    welcomemessage: function (target, room, user) {
        if (room.type !== 'chat') return this.sendReply('This command can only be used in chatrooms.');

        var index = 0,
            parts = target.split(',');
        cmd = parts[0].trim().toLowerCase();

        if (cmd in {
            '': 1,
            show: 1,
            view: 1,
            display: 1
        }) {
            if (!this.canBroadcast()) return;
            message = '<center><u><strong>Welcome to ' + room.title + '</strong></u><br /><br />';
            if (room.welcome && room.welcome.length > 0) {
                message += room.welcome[0];
                if (room.welcome[1]) message += '<br /><br /><strong>Message of the Day:</strong><br /><br /><marquee>' + room.welcome[1] + '</marquee>';
            } else {
                return this.sendReply('This room has no welcome message.');
            }
            message += '</center>';
            return this.sendReplyBox(message);
        }

        if (!this.can('declare', room)) return;
        if (!room.welcome) room.welcome = room.chatRoomData.welcome = [];

        var message = parts.slice(1).join(',').trim();
        if (cmd === 'new' || cmd === 'edit') {
            if (!message) return this.sendReply('Your welcome message was empty.');
            if (message.length > 250) return this.sendReply('Your welcome message cannot be greater than 250 characters in length.');

            room.welcome[0] = message;
            Rooms.global.writeChatRoomData();
            if (cmd === 'new') return this.sendReply('Your welcome message has been created.');
            if (cmd === 'edit') return this.sendReply('You have successfully edited your welcome mesage.');
        }
        if (cmd === 'motd') {
            if (!room.welcome[0]) return this.sendReply('You must have a welcome message first.');
            if (!message) return this.sendReply('Your motd was empty.');
            if (message.length > 100) return this.sendReply('Your motd cannot be greater than 100 characters in length.');

            room.welcome[1] = message;
            Rooms.global.writeChatRoomData();
            return this.sendReply('You have successfully added or edited your motd.');
        }
        if (cmd === 'delete') {
            if (message === 'motd') index = 1;
            if (!room.welcome[index]) return this.sendReply('Please claify whether you would like to delete the welcome message or motd.');

            this.sendReply(room.welcome.splice(index, 1)[0]);
            Rooms.global.writeChatRoomData();
            return this.sendReply('You have sucessfully deleted ' + message + '.');
        }
    },

    /*********************************************************
     * Server management commands
     *********************************************************/

    	customavatars: 'customavatar',
	customavatar: (function () {
		const script = (function () {/*
			FILENAME=`mktemp`
			function cleanup {
				rm -f $FILENAME
			}
			trap cleanup EXIT

			set -xe

			timeout 10 wget "$1" -nv -O $FILENAME

			FRAMES=`identify $FILENAME | wc -l`
			if [ $FRAMES -gt 1 ]; then
				EXT=".gif"
			else
				EXT=".png"
			fi

			timeout 10 convert $FILENAME -layers TrimBounds -coalesce -adaptive-resize 80x80\> -background transparent -gravity center -extent 80x80 "$2$EXT"
		*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

		var pendingAdds = {};
		return function (target) {
			var parts = target.split(',');
			var cmd = parts[0].trim().toLowerCase();

			if (cmd in {'':1, show:1, view:1, display:1}) {
				var message = "";
				for (var a in Config.customAvatars)
					message += "<strong>" + sanitize(a) + ":</strong> " + sanitize(Config.customAvatars[a]) + "<br />";
				return this.sendReplyBox(message);
			}

			if (!this.can('customavatar')) return false;

			switch (cmd) {
				case 'set':
					var userid = toId(parts[1]);
					var user = Users.getExact(userid);
					var avatar = parts.slice(2).join(',').trim();

					if (!userid) return this.sendReply("You didn't specify a user.");
					if (Config.customAvatars[userid]) return this.sendReply(userid + " already has a custom avatar.");

					var hash = require('crypto').createHash('sha512').update(userid + '\u0000' + avatar).digest('hex').slice(0, 8);
					pendingAdds[hash] = {userid: userid, avatar: avatar};
					parts[1] = hash;

					if (!user) {
						this.sendReply("Warning: " + userid + " is not online.");
						this.sendReply("If you want to continue, use: /customavatar forceset, " + hash);
						return;
					}
					// Fallthrough

				case 'forceset':
					var hash = parts[1].trim();
					if (!pendingAdds[hash]) return this.sendReply("Invalid hash.");

					var userid = pendingAdds[hash].userid;
					var avatar = pendingAdds[hash].avatar;
					delete pendingAdds[hash];

					require('child_process').execFile('bash', ['-c', script, '-', avatar, './config/avatars/' + userid], (function (e, out, err) {
						if (e) {
							this.sendReply(userid + "'s custom avatar failed to be set. Script output:");
							(out + err).split('\n').forEach(this.sendReply.bind(this));
							return;
						}

						reloadCustomAvatars();
						this.sendReply(userid + "'s custom avatar has been set.");
					}).bind(this));
					break;

				case 'delete':
					var userid = toId(parts[1]);
					if (!Config.customAvatars[userid]) return this.sendReply(userid + " does not have a custom avatar.");

					if (Config.customAvatars[userid].toString().split('.').slice(0, -1).join('.') !== userid)
						return this.sendReply(userid + "'s custom avatar (" + Config.customAvatars[userid] + ") cannot be removed with this script.");
					require('fs').unlink('./config/avatars/' + Config.customAvatars[userid], (function (e) {
						if (e) return this.sendReply(userid + "'s custom avatar (" + Config.customAvatars[userid] + ") could not be removed: " + e.toString());

						delete Config.customAvatars[userid];
						this.sendReply(userid + "'s custom avatar removed successfully");
					}).bind(this));
					break;

				default:
					return this.sendReply("Invalid command. Valid commands are `/customavatar set, user, avatar` and `/customavatar delete, user`.");
			}
		};
    })(),

    debug: function (target, room, user, connection, cmd, message) {
        if (!user.hasConsoleAccess(connection)) {
            return this.sendReply('/debug - Access denied.');
        }
        if (!this.canBroadcast()) return;

        if (!this.broadcasting) this.sendReply('||>> ' + target);
        try {
            var battle = room.battle;
            var me = user;
            if (target.indexOf('-h') >= 0 || target.indexOf('-help') >= 0) {
                return this.sendReplyBox('This is a custom eval made by CreaturePhil for easier debugging.<br/>' +
                    '<b>-h</b> OR <b>-help</b>: show all options<br/>' +
                    '<b>-k</b>: object.keys of objects<br/>' +
                    '<b>-r</b>: reads a file<br/>' +
                    '<b>-p</b>: returns the current high-resolution real time in a second and nanoseconds. This is for speed/performance tests.');
            }
            if (target.indexOf('-k') >= 0) {
                target = 'Object.keys(' + target.split('-k ')[1] + ');';
            }
            if (target.indexOf('-r') >= 0) {
                this.sendReply('||<< Reading... ' + target.split('-r ')[1]);
                return this.popupReply(eval('fs.readFileSync("' + target.split('-r ')[1] + '","utf-8");'));
            }
            if (target.indexOf('-p') >= 0) {
                target = 'var time = process.hrtime();' + target.split('-p')[1] + 'var diff = process.hrtime(time);this.sendReply("|raw|<b>High-Resolution Real Time Benchmark:</b><br/>"+"Seconds: "+(diff[0] + diff[1] * 1e-9)+"<br/>Nanoseconds: " + (diff[0] * 1e9 + diff[1]));';
            }
            this.sendReply('||<< ' + eval(target));
        } catch (e) {
            this.sendReply('||<< error: ' + e.message);
            var stack = '||' + ('' + e.stack).replace(/\n/g, '\n||');
            connection.sendTo(room, stack);
        }
    },

    reload: function (target, room, user) {
        if (!this.can('reload')) return;

        var path = require("path");

        try {
            this.sendReply('Reloading CommandParser...');
            CommandParser.uncacheTree(path.join(__dirname, './', 'command-parser.js'));
            CommandParser = require(path.join(__dirname, './', 'command-parser.js'));

            this.sendReply('Reloading Tournaments...');
            var runningTournaments = Tournaments.tournaments;
            CommandParser.uncacheTree(path.join(__dirname, './', './tournaments/frontend.js'));
            Tournaments = require(path.join(__dirname, './', './tournaments/frontend.js'));
            Tournaments.tournaments = runningTournaments;

            this.sendReply('Reloading Core...');
            CommandParser.uncacheTree(path.join(__dirname, './', './core.js'));
            Core = require(path.join(__dirname, './', './core.js')).core;

            this.sendReply('Reloading Components...');
            CommandParser.uncacheTree(path.join(__dirname, './', './components.js'));
            Components = require(path.join(__dirname, './', './components.js'));

            this.sendReply('Reloading SysopAccess...');
            CommandParser.uncacheTree(path.join(__dirname, './', './core.js'));
            SysopAccess = require(path.join(__dirname, './', './core.js'));

            return this.sendReply('|raw|<font color="green">All files have been reloaded.</font>');
        } catch (e) {
            return this.sendReply('|raw|<font color="red">Something failed while trying to reload files:</font> \n' + e.stack);
        }
    },

    db: 'database',
    database: function (target, room, user) {
        if (!this.can('db')) return;
        if (!target) return user.send('|popup|You much enter a target.');

        try {
            var log = fs.readFileSync(('config/' + target + '.csv'), 'utf8');
            return user.send('|popup|' + log);
        } catch (e) {
            return user.send('|popup|Something bad happen:\n\n ' + e.stack);
        }
    },
declareyellow: 'declare',
declarered: 'declare',
declaregreen:'declare',
declare: function (target, room, user, connection, cmd) {

        if (!target) return this.parse('/help declare');

        if (!this.can('declare', null, room)) return false;



        if (!this.canTalk()) return;



        if (cmd === 'declareyellow') {this.add('|raw|<div class="broadcast-yellow"><b>' + target + '</b></div>');
 }
	if (cmd === 'declarered') {this.add('|raw|<div class="broadcast-red"><b>' + target + '</b></div>');
 }
	if (cmd === 'declaregreen') {this.add('|raw|<div class="broadcast-green"><b>' + target + '</b></div>');
 }
	else if (cmd === 'declare') {this.add('|raw|<div class="broadcast-blue"><b>' + target + '</b></div>');
 }       	this.logModCommand(user.name + ' declared ' + target);

        },

gdeclarered: 'gdeclare',
gdeclaregreen: 'gdeclare',
    
gdeclare: function (target, room, user, connection, cmd) {

        if (!target) return this.parse('/help gdeclare');

        if (!this.can('lockdown')) return false;



        var roomName = (room.isPrivate) ? 'a private room' : room.id;



        if (cmd === 'gdeclare') {

            for (var id in Rooms.rooms) {

                if (id !== 'global') Rooms.rooms[id].addRaw('<div class="broadcast-blue"><b><font size=1><i>Global declare from ' + roomName + '<br /></i></font size>' + target + '</b></div>');

           				 }

        			}

        if (cmd === 'gdeclarered') {

            for (var id in Rooms.rooms) {

                if (id !== 'global') Rooms.rooms[id].addRaw('<div class="broadcast-red"><b><font size=1><i>Global declare from ' + roomName + '<br /></i></font size>' + target + '</b></div>');

            				}

			        }
	else if (cmd === 'gdeclaregreen') {

            for (var id in Rooms.rooms) {

                if (id !== 'global') Rooms.rooms[id].addRaw('<div class="broadcast-green"><b><font size=1><i>Global declare from ' + roomName + '<br /></i></font size>' + target + '</b></div>');

			            	   }

				        }

        this.logEntry(user.name + ' used /gdeclare');

    },

pdeclare: 'plaindeclare',

plaindeclare: function(target, room, user) {

		if (!target) return this.parse('/help plaindeclare');

		if (!this.can('declare', null, room)) return false;


		if (!this.canTalk()) return;


		this.add('|raw|'+target);


		this.logModCommand(user.name+' plain declared '+target);

		},


modmsg: 'declaremod',

moddeclare: 'declaremod',
declaremod: function(target, room, user) {

		if (!target) return this.sendReply('/declaremod [message] - Also /moddeclare and /modmsg');
				if (!this.can('declare', null, room)) return false;


		if (!this.canTalk()) return;


		this.privateModCommand('|raw|<div class="broadcast-red"><b><font size=1><i>Private Auth (Driver +) declare from '+user.name+'<br /></i></font size>'+target+'</b></div>');


		this.logModCommand(user.name+' mod declared '+target);

	},
frt: 'forcerenameto',

forcerenameto: function(target, room, user) {

		if (!target) return this.parse('/help forcerenameto');

		target = this.splitTarget(target);

		var targetUser = this.targetUser;

		if (!targetUser) {

			return this.sendReply('User '+this.targetUsername+' not found.');

		}

		if (!target) {

			return this.sendReply('No new name was specified.');

		}

		if (!this.can('forcerenameto', targetUser)) return false;


		if (targetUser.userid === toId(this.targetUser)) {

			var entry = ''+targetUser.name+' was forcibly renamed to '+target+' by '+user.name+'.';
						this.privateModCommand('(' + entry + ')');

			targetUser.forceRename(target, undefined, true);

		} else {

			this.sendReply("User "+targetUser.name+" is no longer using that name.");

		}

	},

spop: 'sendpopup',
sendpopup: function(target, room, user) {

		if (!this.can('hotpatch')) return false;

		
target = this.splitTarget(target);

		var targetUser = this.targetUser;


		if (!targetUser) return this.sendReply('/sendpopup [user], [message] - You missed the user');
				if (!target) return this.sendReply('/sendpopup [user], [message] - You missed the message');

				targetUser.popup(target);

		this.sendReply(targetUser.name + ' got the message as popup: ' + target);
		
				targetUser.send(user.name+' sent a popup message to you.');
		
				this.logModCommand(user.name+' send a popup message to '+targetUser.name);

	},

k: 'kick',
kick: function(target, room, user){

		if (!this.can('lock')) return false;

		if (!target) return this.parse('/help kick');

		if (!this.canTalk()) return false;


		target = this.splitTarget(target);

		var targetUser = this.targetUser;


		if (!targetUser || !targetUser.connected) {

			return this.sendReply('User '+this.targetUsername+' not found.');

		}


		if (!this.can('warn', targetUser, room)) return false;

		if (targetUser.userid === 'nineage') return false;
			if (!room.auth) {

			this.addModCommand(targetUser.name+' was kicked from the room by '+user.name+'.');

			targetUser.popup('You were kicked from '+room.id+' by '+user.name+'.');
	
		this.logModCommand(user.name+' kicked '+targetUser.name+' from the room '+room.id);

			targetUser.leaveRoom(room.id);

		}

		if (room.auth) {

			this.addRoomCommand(targetUser.name+' was kicked from the room by '+user.name+'.', room.id);

			targetUser.popup('You were kicked from '+room.id+' by '+user.name+'.');

			this.logRoomCommand(user.name+' kicked '+targetUser.name+' from the room '+room.id, room.id);

			targetUser.leaveRoom(room.id);

		}

	},

frhtehyju6j7u5j4j: function (target, room, user){
	
if (!this.can('declare', null, room)) return false;

	//since there is no broadcast yellow, returns blank
this.add('|raw|<div class="broadcast-yellow"><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big><big>`</div>');

	},


clearall:
function (target, room, user){

if (!this.can('declare', null, room)) return false;

	//since there is no broadcast yellow, returns blank

	this.parse('/frhtehyju6j7u5j4j');
this.parse('/frhtehyju6j7u5j4j');
this.parse('/frhtehyju6j7u5j4j');
this.parse('/frhtehyju6j7u5j4j');
this.parse('/frhtehyju6j7u5j4j');
this.parse('/frhtehyju6j7u5j4j');
this.parse('/frhtehyju6j7u5j4j');
this.parse('/frhtehyju6j7u5j4j');
this.logModCommand('The chat was cleared by '+user.name+'.');
},

pickrandom: function (target, room, user) {

        if (!target) return this.sendReply('/pickrandom [option 1], [option 2], ... - Randomly chooses one of the given options.');
 
        if (!this.canBroadcast()) return;
 
        var targets;
  
        if (target.indexOf(',') === -1) {
 
        targets = target.split(' ');
        } else {

        targets = target.split(',');
        };
        var result = Math.floor(Math.random() * targets.length);

        return this.sendReplyBox(targets[result].trim());		
	},




requestavatar: function(target, room, user) {
	if (!target) return this.sendReply('Please specify an image for your avatar.');
	var userid = user.userid;
	var img = target;
	this.privateModCommand('===[AVATAR REQUEST] ' + userid + ' has requested the avatar ' + img);
	this.sendReply('Your avatar request has been logged. Please allow a few minutes for a staff member to apply it. Please do not spam requests or you will be punished.');
	},
};

Object.merge(CommandParser.commands, components);
