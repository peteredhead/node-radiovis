# node-radiovis #

This project is a demonstration of a self-contained RadioVIS system, comprising of:
  * a message and slide manager
  * a RadioVIS sender
  * a basic Stomp server
  * a Comet server
  * a live monitor

Written in node.js (a server-side implementation of javascript) this server is compatible with Linux and Mac OS X. It should be possible to run this application using Windows and CygWin, although this has not been tested.

### Installation Instructions ###

If it is not already present on the system, download and install node.js
http://nodejs.org/#download

Download node-server

Running the server using the command:
`node server.js`

Note that the application must be run by a user with permission to bind to port 80.

### Configuration ###

![http://musicradio.com/img/misc/node-radiovis-admin.png](http://musicradio.com/img/misc/node-radiovis-admin.png)

Open a browser the same machine and go to http://localhost/admin

Set the parameters for your station.

Finally, edit the messages and slide urls.