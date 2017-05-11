![](https://samson.zende.sk/projects/notification_app/stages/staging.svg?token=84457be797bb7a1e00d1f57575d5112a)

# Notification App

This is an agent notification app.

It has two goals:

1. demonstrating a possible usage of the `notify` endpoint of ZAM,
2. broadcasting messages to signed-in agents.

Only administrators can broadcast messages. They can send them to everybody, or
just target a few groups.

The messages can use a restricted subset of Markdown:

* links
* images
* bold
* italic
* level 3 header

Also, URLs are detected and automatically turned either into a link or an image.


#### Contributing

Reviews and pull requests are more than welcome!

## Deployment
This app is deployed using [ZAT](https://github.com/zendesk/zendesk_apps_tools) via [Samson](https://github.com/zendesk/samson) on staging ([link for Zendesk deployers](https://samson.zende.sk/projects/notification_app/stages/staging)).


http://icooon-mono.com/00001-%E7%84%A1%E6%96%99%E3%81%AE%E8%A8%AD%E5%AE%9A%E6%AD%AF%E8%BB%8A%E3%82%A2%E3%82%A4%E3%82%B3%E3%83%B3/