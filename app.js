(function() {
  // jQuery.Event.which key codes. These should be normalized across browsers
  var keyCode = {
    BACKSPACE: 8,
    ENTER: 13,
    COMMA: 44
  };

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
      'click .token .delete': 'onTokenDelete',
      'click .token_list': 'onTokenListClick',
      'click .select_token_submit': 'onSelectClick'
    },

    requests: {
      sendMsg: function(text, roleIds) {
        return {
          url: '/api/v2/apps/notify.json',
          type: 'POST',
          data: {
            event: 'notificationMessage',
            body: {
              text: text,
              roleIds: roleIds
            },
//            app_id: this.id()
            app_id: 0
          }
        };
      },

      getRoles: function() {
        return {
          url: '/api/v2/custom_roles.json',
          type: 'GET'
        };
      }
    },

    notifications: null,
    myRoleId: null,
    roles: null,

    init: function() {
      var self = this;

      this.notifications = [];
      this.myRoleId    = null;
      this.roles        = {};

      this.ajax('getRoles').done(function(data) {
        var customRoles = data.custom_roles;
        _.map(customRoles, function(role) {
          self.roles[role.id] = role.name;
        });
        console.log('roles:');
        console.log(self.roles);
        self.myRoleId = this.currentUser().role();
        self.drawInbox();
      });
    },

    drawInbox: function() {
      var notify_users = this.setting('notify_users');
      console.log('notify_users:');
      console.log(notify_users);
      console.log('myRoleId:');
      console.log(this.myRoleId);
      var isNotify = (notify_users[this.myRoleId] === true);
      this.switchTo('inbox', {
        isNotify: isNotify
      });
      console.log('notifications:');
      console.log(this.notifications);
      this.notifications.forEach(function(notification) {
        this.addMsgToWindow(notification.message, notification.sender);
      }, this);
    },

    drawSelectBox: function() {
      console.log('drawSelectBox:');
      console.log(this.roles);
      var html = '<select name="roles">';
      html += '<option value="">-</option>';
      Object.keys(this.roles).forEach(function (key) {
        html += '<option value="' + key + '">' + this.roles[key] + '</option>';
      }, this);
      html += '</select>';
      this.$('.select_groups').html(html);
    },

    messageBox: function() {
      return this.$('textarea.message');
    },

    onNewMessageClick: function(event) {
      event.preventDefault();
      this.switchTo('admin');
      this.$('.groups input').autocomplete({
        source: _.keys(this.roles)
      });
      this.messageBox().focus();
      this.drawSelectBox();
    },

    onCancelClick: function(event) {
      event.preventDefault();
      this.drawInbox();
    },

    onSelectClick: function() {
      // グループ指定時
      var roleId = this.$('.select_groups option:selected').val();
      this.$('.token_list').append('<li class="role_id">' + roleId +  '</li>');
    },

    messageBoxValue: function() {
      return this.messageBox().val();
    },

    isMessageEmpty: function() {
      return !this.messageBoxValue().trim();
    },

    sendMsg: function() {
      console.log('token_list:');
      console.log(this.tokenValues());
      var roleIds = this.tokenValues();

      this.ajax('sendMsg', this.messageBoxValue(), roleIds);
      this.drawInbox();
    },

    tokenValues: function() {
      return _.map(this.$('.token_list').children(), function(token) {
        return token.textContent;
      });
    },

    onNewMessageKeyUp: function() {
      this.$('#send-msg').prop('disabled', this.isMessageEmpty());
    },

    onNewMessageKeyPress: function(event) {
      if (this.isMessageEmpty()) { return; }

      if ((event.ctrlKey || event.metaKey) && event.which === keyCode.ENTER) {
        this.sendMsg();
      }
    },

    onTokenListClick: function(event) {
      var input = this.$(event.target).children('.add_token')
          .children('input')[0];
      if (input !== undefined) {
        input.focus();
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

    markdown: function(source) {
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

      _.each(buffer, function(value, index) {
        source = source.replace(['@@', index, '@@'].join(''), value);
      });
      return source;
    },

    onMessageCloseClick: function(event) {
      event.preventDefault();
      var $notification = this.$(event.target).parent();
      this.notifications = _.reject(this.notifications, function(notification) {
        return notification.message.uuid === $notification.data('uuid');
      });
      $notification.remove();
    },

    onIncomingMessage: function(message, sender) {
      console.log('!!!!message:');
      console.log(message);
      console.log('!!!!sender:');
      console.log(sender);

      if (sender.email() === this.currentUser().email()) {
        return false;
      }

      var targetRoleIds = _.map(message.roleIds, function(id) { return parseInt(id, 10); });
      console.log('!!!!myRoleId:');
      console.log(this.myRoleId);
      console.log('!!!!targetRoleIds:');
      console.log(targetRoleIds);
      console.log('!!!!message.roleIds:');
      console.log(message.roleIds);
      if (message.roleIds && !_.intersection([this.myRoleId], targetRoleIds).length) {
        return false;
      }

      message.uuid = _.uniqueId('msg');

      // Store notification so that we can re-render it later
      this.notifications.push({
        message: message,
        sender: sender,
      });

      try { this.popover(); } catch(err) {}

      // defer ensures app is in DOM before we add a message
      _.defer(this.addMsgToWindow.bind(this), message, sender);
    },

    addMsgToWindow: function(message, sender) {
      this.$('.placeholder').hide();

      // We get sent two messages, so this makes sure we only display
      // each unique message once:
      if (this.$('li.message[data-uuid=%@]'.fmt(message.uuid)).length > 0) {
        return false;
      }

      // escape HTML
      var text = this.$('<div/>').text(message.text).html();
      text = this.markdown(text);

      var messageHTML = this.renderTemplate('message', {
        uuid: message.uuid,
        text: text,
        senderName: sender.name(),
        date: (new Date()).toLocaleString()
      });

      this.$('ul#messages').prepend(messageHTML);
    },

/*    loadAllRoles: function() {
      var self = this;

      return this.promise(function(done) {
        self.groupRequests().then(function(requests) {
          self.when.apply(self, requests).then(function() {
            if (requests.length === 1) {
              done([arguments[0]]);
            } else if (requests.length > 1) {
              done(_.pluck(arguments, 0));
            } else {
              done([]);
            }
          });
        });
      });
    },*/

/*    groupRequests: function() {
      var self = this;

      return this.promise(function(done) {
        var first_page = this.ajax('getAssignableGroups', 1);

        first_page.then(function(data){
          var pages = Math.ceil(data.count / 100);

          done([first_page].concat(_.range(2, pages + 1).map(function(page) {
            return self.ajax('getAssignableGroups', page);
          })));
        });
      });
    }*/
  };

}());
