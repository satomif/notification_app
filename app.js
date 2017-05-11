(function () {
    // jQuery.Event.which key codes. These should be normalized across browsers
    var keyCode = {
        BACKSPACE: 8,
        ENTER: 13,
        COMMA: 44
    };
    var Storage = require('storage.js');

    return {
        events: {
            'app.activated': 'init',
            'click #send-msg': 'sendMsg',
            'click a.close': 'onMessageCloseClick',
            'keyup .message': 'onNewMessageKeyUp',
            'keypress .message': 'onNewMessageKeyPress',
            'notification.notificationMessage': 'onIncomingMessage',
            'click .new-message': 'onNewMessageClick',
            'click .cancel': 'onCancelClick',
            'click .setting': 'onSettingClick',
            'click .clear-cache': 'onClearCache',
        },

        requests: {
            sendMsg: function (text, roleIds) {
                return {
                    url: '/api/v2/apps/notify.json',
                    type: 'POST',
                    data: {
                        event: 'notificationMessage',
                        body: {
                            text: text,
                            roleIds: roleIds
                        },
                        app_id: this.id()
//                        app_id: 0
                    }
                };
            },

            getRoles: function () {
                return {
                    url: '/api/v2/custom_roles.json',
                    type: 'GET'
                };
            }
        },

        notifications: null,
        myRoleId: null,
        roles: null,

        init: function () {
            var self = this;

            this.notifications = [];
            this.myRoleId = '';
            this.roles = {};
            this.roleStrageMin = 120;   // 2hour
            Storage.constructor.call(this, this.setting('name') + this.id());

            this.getStorageRoles();
        },

        drawInbox: function () {
            // 送信可能ユーザ
            var sendableUsers = this.setting('sendable_users').split(',');
            console.log('----sendableUsers:');
            console.log(sendableUsers);
            console.log('----myRoleId:');
            console.log(this.myRoleId);
            console.log(sendableUsers.indexOf(this.myRoleId));
            var isNotify = (sendableUsers.indexOf(this.myRoleId) >= 0);
            this.switchTo('inbox', {
                isNotify: isNotify
            });
            console.log('----notifications:');
            console.log(this.notifications);
            this.notifications.forEach(function (notification) {
                this.addMsgToWindow(notification.message, notification.sender, notification.targetRoleNames );
            }, this);
        },

        drawSelectBox: function () {
            var html = '';
            Object.keys(this.roles).forEach(function (key) {
                html += '<label for="roles_checkbox' + key + '">' +
                    '<input type="checkbox" name="roles" value="' + key + '" id="roles_checkbox' + key +'">' + this.roles[key] +
                    '</label>';
            }, this);
            this.$('.select_groups').html(html);
        },

        messageBox: function () {
            return this.$('textarea.message');
        },

        onNewMessageClick: function (event) {
            event.preventDefault();
            this.switchTo('admin');
            this.$('.groups input').autocomplete({
                source: _.keys(this.roles)
            });
            this.messageBox().focus();
            this.drawSelectBox();
        },

        onCancelClick: function (event) {
            event.preventDefault();
            this.drawInbox();
        },

        onSettingClick: function (event) {
            event.preventDefault();
            this.switchTo('setting');
        },

        messageBoxValue: function () {
            return this.messageBox().val();
        },

        isMessageEmpty: function () {
            return !this.messageBoxValue().trim();
        },

        sendMsg: function () {
            var roleIds = this.tokenValues();
            console.log('---send message role :');
            console.log(roleIds);
            this.ajax('sendMsg', this.messageBoxValue(), roleIds);
            this.drawInbox();
        },

        tokenValues: function () {
            var self = this;
            // string[]
            var roleIds = [];
            this.$('.select_groups').find(':checked').each(function() {
                console.log('-----select_groups:');
                console.log(self.$(this).val());
                roleIds.push(self.$(this).val() + '');
            });

            return roleIds;
        },

        onNewMessageKeyUp: function () {
            this.$('#send-msg').prop('disabled', this.isMessageEmpty());
        },

        onNewMessageKeyPress: function (event) {
            if (this.isMessageEmpty()) {
                return;
            }

            if ((event.ctrlKey || event.metaKey) && event.which === keyCode.ENTER) {
                this.sendMsg();
            }
        },

        REGEXP_URL: /https?:\/\/(\S+)/i,
        REGEXP_IMAGE: /\.(png|gif|bmp|jpg|jpeg|ico)$/i,
        REPLACEMENTS: [
            [/^### (.+?)$/m, "<h3>$1</h3>"],
            [/(\*\*|__)(.+?)\1/, "<strong>$2</strong>"],
            [/(\*|_)(.+?)\1/, "<em>$2</em>"],
            [/!\[(.*?)\]\((.+?)\)/, '<img src="$2" alt="$1">'],
            [/\[(.+?)\]\((\/.+?)\)/, '<a href="$2">$1</a>'],
            [/\[(.+?)\]\((https?:\/\/.+?)\)/, '<a href="$2" target="_blank">$1</a>']
        ],

        markdown: function (source) {
            var buffer = [],
                count = 0,
                match = null,
                pair, regex, replacement;

            for (var index = 0; index < this.REPLACEMENTS.length; ++index) {
                pair = this.REPLACEMENTS[index];
                regex = pair[0];
                replacement = pair[1];

                while ((match = source.match(regex))) {
                    buffer.push(match[0].replace(regex, replacement));
                    source = source.replace(match[0], ['@@', count, '@@'].join(''));
                    ++count;
                }
            }

            while ((match = source.match(this.REGEXP_URL))) {
                if (match[0].match(this.REGEXP_IMAGE)) {
                    replacement = '<img src="%@" alt="%@">'.fmt(match[0], match[0]);
                } else {
                    replacement = '<a href="%@" target="_blank">%@</a>'.fmt(match[0], match[0]);
                }
                source = source.replace(match[0], ['@@', count, '@@'].join(''));
                buffer.push(replacement);
                ++count;
            }

            _.each(buffer, function (value, index) {
                source = source.replace(['@@', index, '@@'].join(''), value);
            });
            return source;
        },

        onMessageCloseClick: function (event) {
            event.preventDefault();
            var $notification = this.$(event.target).parent();
            this.notifications = _.reject(this.notifications, function (notification) {
                return notification.message.uuid === $notification.data('uuid');
            });
            $notification.remove();
        },

        onIncomingMessage: function (message, sender) {
            console.log('!!!!message:');
            console.log(message);
            console.log('!!!!sender:');
            console.log(sender);

            // 送信者本人は不要
            if (sender.email() === this.currentUser().email()) {
                return false;
            }
            // 全メッセージ受け取り可能ユーザ
            var notifiableUsers = this.setting('notifiable_users').split(',');
            var targetRoleIds = _.map(message.roleIds, function (id) {
                return id + '';
            });
            console.log('!!!!myRoleId:');
            console.log(this.myRoleId);
            console.log('!!!!targetRoleIds:');
            console.log(targetRoleIds);
            console.log('!!!!message.roleIds:');
            console.log(message.roleIds);
            console.log('!!!!IStargetRoleIds:');
            console.log(targetRoleIds.indexOf(this.myRoleId));
            if (message.roleIds && targetRoleIds.indexOf(this.myRoleId) === -1 && notifiableUsers.indexOf(this.myRoleId) === -1) {
                console.log("don't show");
                return false;
            }

            message.uuid = _.uniqueId('msg');

            // 送信先ロール名取得
            console.log(this.roles);
            var targetRoleNames = [];
            for(var i = 0; i < targetRoleIds.length; i++) {
                console.log('!!!!key:');
                console.log(targetRoleIds[i]);
                console.log(this.roles[targetRoleIds[i]]);
                targetRoleNames.push(this.roles[targetRoleIds[i]]);
            }
            console.log('!!!!targetRoleNames:');
            console.log(targetRoleNames);

            // Store notification so that we can re-render it later
            this.notifications.push({
                message: message,
                sender: sender,
                targetRoleNames : targetRoleNames
            });
            console.log("show message");

            try {
                this.popover();
            } catch (err) {
            }

            // defer ensures app is in DOM before we add a message
            _.defer(this.addMsgToWindow.bind(this), message, sender, targetRoleNames);
        },

        addMsgToWindow: function (message, sender, targetRoleNames) {
            this.$('.placeholder').hide();
            console.log('targetRoleNames:');
            console.log(targetRoleNames);

            // We get sent two messages, so this makes sure we only display
            // each unique message once:
            if (this.$('li.message[data-uuid=%@]'.fmt(message.uuid)).length > 0) {
                return false;
            }

            // escape HTML
            var text = this.$('<div/>').text(message.text).html();
            text = this.markdown(text);

            console.log('sender:');
            console.log(sender);
            // targetRoleNamesがない場合は全通知
            if (targetRoleNames.length === 0) {
                targetRoleNames = ['ALL'];
            }

            var messageHTML = this.renderTemplate('message', {
                uuid: message.uuid,
                text: text,
                roles: targetRoleNames.join(','),
                senderName: sender.name(),
                date: (new Date()).toLocaleString()
            });

            this.$('ul#messages').prepend(messageHTML);
        },

        getStorageRoles: function() {
            this.roles = Storage.get.call(this, 'roles');
            if (this.roles) {
                console.log('from cache!!');
                console.log(this.roles);
                this.myRoleId = this.currentUser().role() + '';
                this.drawInbox();
                return;
            }

            this.roles = {};
            var self = this;
            this.ajax('getRoles').done(function (data) {
                var customRoles = data.custom_roles;
                console.log('customRoles!!');
                console.log(customRoles);
                _.map(customRoles, function (role) {
                    self.roles[role.id] = role.name;
                });
                console.log('from api!!');
                console.log(self.roles);
                Storage.set.call(this, 'roles', self.roles, self.roleStrageMin);
                self.myRoleId = this.currentUser().role() + '';
                self.drawInbox();
            });

        },

        onClearCache: function(event) {
            event.preventDefault();
            var roles = Storage.get.call(this, 'roles');
            if (!roles) {
                alert('削除済みです');
                return;
            }
            Storage.set.call(this, 'roles', null);
            this.getStorageRoles();
        }
    };

}());
