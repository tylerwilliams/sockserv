package main

import (
	"flag"
	"fmt"
	"github.com/igm/sockjs-go/sockjs"
	"log"
	"net/http"
	"strconv"
	"strings"
)

var (
	port      = flag.Int("port", 8080, "port to listen on")
	staticDir = flag.String("static_file_dir", "./static", "directory of static files")
)

// ConnectionManager manages all known connections.
type ConnectionManager struct {
    connections map[*sockjs.Conn]bool
}


func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[*sockjs.Conn]bool),
	}
}

func (c *ConnectionManager) IsRegistered(conn *sockjs.Conn) bool {
	_, present := c.connections[conn]
	return present
}

func (c *ConnectionManager) Register(conn *sockjs.Conn) {
	c.connections[conn] = true
	s := fmt.Sprintf("connected:%d", conn)
	go (*conn).WriteMessage([]byte(strconv.Quote(s)))
}

type ChannelManager struct {
	channels map[string][]*sockjs.Conn
}

func NewChannelManager() *ChannelManager {
	return &ChannelManager{
		channels: make(map[string][]*sockjs.Conn),
	}
}

func (c *ChannelManager) Register(channel string, conn *sockjs.Conn) {
	c.channels[channel] = append(c.channels[channel], conn)

	s := fmt.Sprintf("subscribed:%s", channel)
	go (*conn).WriteMessage([]byte(strconv.Quote(s)))
}

func (c *ChannelManager) Broadcast(channel string, source *sockjs.Conn, msg []byte) {
	for _, conn := range c.channels[channel] {
		if *source == *conn { /* don't send ourselves this message :P */
			continue
		}
		go (*conn).WriteMessage(msg)
	}
}

func handleMessage(conn *sockjs.Conn, msg []byte, c *ChannelManager) {
	ms, err := strconv.Unquote(string(msg))
	if err != nil {
		log.Printf("unable to unquote message: %v", msg)
		return
	}
	log.Printf("raw message: '%s'", ms)

	if strings.HasPrefix(ms, "subscribe:") {
		channel := strings.TrimPrefix(ms, "subscribe:")
		log.Printf("subscribed %v to channel: '%s'", &conn, channel)
		c.Register(channel, conn)
	} else if strings.HasPrefix(ms, "broadcast:") {
		parts := strings.SplitN(ms, ":", 3)
		log.Printf("%v published '%s' to channel: '%s'", &conn, parts[2], parts[1])
		c.Broadcast(parts[1], conn, []byte(strconv.Quote(parts[2])))
	} else {
		log.Printf("%v unhandled %s", &conn, string(ms))
	}
}

func EchoHandler(conn sockjs.Conn, c *ConnectionManager, ch *ChannelManager) {
	if (!c.IsRegistered(&conn)) {
		c.Register(&conn)
	}
	for {
		if msg, err := conn.ReadMessage(); err == nil {
			go handleMessage(&conn, msg, ch)
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
 	log.Printf("static dir: %s", *staticDir)
	log.Printf("sockserv listening on %s:%d...", "localhost", *port)
	http.Handle("/static/", http.StripPrefix("/static", http.FileServer(http.Dir(*staticDir))))

	err := http.ListenAndServe(fmt.Sprintf(":%d", *port), nil)
	log.Fatal(err)
}
