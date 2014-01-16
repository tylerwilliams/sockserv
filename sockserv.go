package main

import (
	"flag"
	"fmt"
	"github.com/igm/sockjs-go/sockjs"
	"github.com/golang/glog"
	"github.com/nu7hatch/gouuid"
	"net/http"
	"strconv"
	"strings"
)

var (
	port      = flag.Int("port", 8080, "port to listen on")
	staticDir = flag.String("static_file_dir", "./static", "directory of static files")
)

// A ConnectionManager maintains the state of all known connections and their
// respective connectionIds.
type ConnectionManager struct {
    connections map[*sockjs.Conn]string
    connectionIDs map[string]*sockjs.Conn
}

// NewConnectionManager makes and returns a pointer to a new ConnectionManager.
func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[*sockjs.Conn]string),
		connectionIDs: make(map[string]*sockjs.Conn),
	}
}

// IsRegistered returns a boolean indicating if a particular connection is registered
// with this ConnectionManager.
func (c *ConnectionManager) IsRegistered(conn *sockjs.Conn) bool {
	return c.connections[conn] != ""
}

// Register registers a connection with the Connection Manager.
func (c *ConnectionManager) Register(conn *sockjs.Conn) string {
	connUUID, err := uuid.NewV4()
	if err != nil {
		glog.Warningf("unable to generate connection uuid: %v", err)
	}
	connID := connUUID.String()
	c.connections[conn] = connID
	c.connectionIDs[connID] = conn
	return connID
}

// GetConnection returns the connection specified by the given uuid string.
func (c *ConnectionManager) GetConnection(uuid string) *sockjs.Conn {
	return c.connectionIDs[uuid]
}

// GetConnection returns the uuid for the specified connection.
func (c *ConnectionManager) GetID(conn *sockjs.Conn) string {
	return c.connections[conn]
}

// A ChannelManager keeps track of the connections registered for a particular channel.
type ChannelManager struct {
	channels map[string]map[*sockjs.Conn]bool
}

// NewChannelManager makes and returns a pointer to a new ChannelManager.
func NewChannelManager() *ChannelManager {
	return &ChannelManager{
		channels: make(map[string]map[*sockjs.Conn]bool),
	}
}

// Register registers a connection with a particular channel.
func (c *ChannelManager) Register(channel string, conn *sockjs.Conn) {
	if c.channels[channel] == nil {
		c.channels[channel] = make(map[*sockjs.Conn]bool)
	}
	c.channels[channel][conn] = true
}

// Broadcast sends a message to all the subscribers of a particular channel, minus the sender.
func (c *ChannelManager) Broadcast(channel string, source *sockjs.Conn, msg []byte) {
	for conn := range c.channels[channel] {
		if *source == *conn { /* don't send this message to ourself :P */
			continue
		}
		go (*conn).WriteMessage(msg)
	}
}

func handleMessage(conn *sockjs.Conn, msg []byte, c *ConnectionManager, cm *ChannelManager) {
	ms, err := strconv.Unquote(string(msg))
	if err != nil {
		glog.Warningf("unable to unquote message: %v", msg)
		return
	}
	glog.Infof("raw message: '%s'", ms)

	messageParts := strings.SplitN(ms, ":", 2)
	messageType := messageParts[0]

	switch messageType {
	case "sub":
		channel := messageParts[1]
		glog.Infof("subscribed %v to channel: '%s'", c.GetID(conn), channel)
		cm.Register(channel, conn)
		go (*conn).WriteMessage([]byte(strconv.Quote(fmt.Sprintf("sub:%s", channel))))
		break
	case "pub":
		chm := strings.SplitN(messageParts[1], ":", 2)
		channel := chm[0]
		msgText := chm[1]
		pm := fmt.Sprintf("pub:%s:%s:%s", channel, c.GetID(conn), msgText)
		go cm.Broadcast(channel, conn, []byte(strconv.Quote(pm)))
		glog.Infof("%v published '%s' to channel: '%s'", c.GetID(conn), msgText, channel)
		break
	case "msg":
		rm := strings.SplitN(messageParts[1], ":", 2)
		recipientConn := c.GetConnection(rm[0])
		sm := fmt.Sprintf("msg:%s:%s", c.GetID(conn), rm[1])
		go (*recipientConn).WriteMessage([]byte(strconv.Quote(sm)))
		break
	default:
		glog.Warningf("%v unhandled %s", &conn, string(ms))
	}
}

func EchoHandler(conn sockjs.Conn, c *ConnectionManager, ch *ChannelManager) {
	if (!c.IsRegistered(&conn)) {
		connID := c.Register(&conn)
		go conn.WriteMessage([]byte(strconv.Quote(fmt.Sprintf("con:%s", connID))))
		glog.Infof("new conn: %s", connID)
	}
	for {
		if msg, err := conn.ReadMessage(); err == nil {
			go handleMessage(&conn, msg, c, ch)
		} else {
			return
		}
	}
}

func main() {
	flag.Parse()

	cm := NewConnectionManager()
	chm := NewChannelManager()
	sockjs.Install("/echo", func(conn sockjs.Conn) {
		EchoHandler(conn, cm, chm)
	}, sockjs.DefaultConfig)
 	glog.Infof("static dir: %s", *staticDir)
	glog.Infof("sockserv listening on %s:%d...", "localhost", *port)
	http.Handle("/static/", http.StripPrefix("/static", http.FileServer(http.Dir(*staticDir))))

	err := http.ListenAndServe(fmt.Sprintf(":%d", *port), nil)
	glog.Fatal(err)
}
