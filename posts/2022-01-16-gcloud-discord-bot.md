---
title: "Building a Discord bot with Go on Google Cloud's free tier"
date: "2022-01-16"
tags: ["Google Cloud", "Tutorial", "Discord"]
summary: "Using the Cloud Run and Cloud Scheduler, we'll create a Discord bot that listens for a specific word, and responds. Code included."
---

If you spend any time on Discord, you know that bots are everywhere. But how does a bot get created, and where does it get hosted?

I've been exploring Discord bots for my <a target="_blank" rel="noreferrer" href="https://floor.report">Floor Report</a> app. The bot I created listens for a specific command, like `f boredapeyachtclub`, and returns the floor price for that particular collection on <a target="_blank" rel="noreferrer" href="https://opensea.io">OpenSea</a>.

![]('../images/blog/2022-01-16-gcloud-discord-bot/floor-report-discord-bot.png)

The code for this is surprisingly simple, and we'll walk though a basic app written in Go that you can customize for your needs. You can also host this app on Google Cloud's free tier. We'll be using <a target="_blank" rel="noreferrer" href="https://cloud.google.com/run">Cloud Run</a> and <a target="_blank" rel="noreferrer" href="https://cloud.google.com/scheduler">Cloud Scheduler</a>.

![]('../images/blog/2022-01-16-gcloud-discord-bot/diagram.png)

## Prerequisites

- Sign up for <a target="_blank" rel="noreferrer" href="https://cloud.google.com/">Google Cloud</a>, and create a billing account. You will most likely get $300 of free credit, but we actually won't even dip into pool because your app will be very lightweight.
- Terminal app (on Mac, Applications > Utilities > Terminal)
- <a target="_blank" rel="noreferrer" href="https://code.visualstudio.com/download">VSCode</a> or other text editor

## Getting Started

The first step is to login to Google Cloud and create a project. Open up your terminal and run:

```sh
gcloud auth login
```

This will open up a browser window so you can login. Next, create the project:

```sh
gcloud projects create my-example-project-999
```

The ouput should be something like this:

```sh
➜  gcloud projects create my-example-project-999
Create in progress for [https://cloudresourcemanager.googleapis.com/v1/projects/my-example-project-999].
Waiting for [operations/cp.5459862736956130717] to finish...done.
Enabling service [cloudapis.googleapis.com] on project [my-example-project-999]...
Operation "operations/acf.p2-8759988169-05a79294-ae4a-4885-810c-1be5af3e50cb" finished successfully.
```

Once this is done, create a new folder wherever you have your code called `my-example-project-999` or anything you want.

```sh
mkdir my-example-project-999
cd my-example-project-999
```

Next, let's create a Go module:

```sh
go mod init github.com/YOUR_GITHUB_USERNAME/my-example-project-999
```

Let's also create our main.go file and open VSCode.

```sh
touch main.go
code .
```

Add the following to your main.go file:

```go
package main

import (
	"fmt"

	"go.uber.org/fx"
)

func main() {
	fx.New(
		fx.Invoke(Register),
	).Run()
}

func Register(
	lc fx.Lifecycle,
) {
	fmt.Println("Hello, World!")
}
```

Run `go mod tidy && go run main.co` and you should see this:

```sh
➜  go mod tidy && go run main.go
go: finding module for package go.uber.org/fx
go: found go.uber.org/fx in go.uber.org/fx v1.16.0
[Fx] PROVIDE	fx.Lifecycle <= go.uber.org/fx.New.func1()
[Fx] PROVIDE	fx.Shutdowner <= go.uber.org/fx.(*App).shutdowner-fm()
[Fx] PROVIDE	fx.DotGraph <= go.uber.org/fx.(*App).dotGraph-fm()
[Fx] INVOKE		main.Register()
Hello, World!
[Fx] RUNNING
```

So what just happened here?

Let's run by the file line by line:

- First, we declared the package name `main` (this is standard in Go for the entrypoint to your app).
- Next we imported a few libraries, the standard `fmt` and Go-fx from Uber at `go.uber.org/fx`. I've <a href="../building-a-coffee-api-with-go-fx-and-firestore">used this library before</a>, so I won't go into much detail here, but it makes your application super moudlar and it's easy to inject dependencies.
- Our `main` function initializes Fx and invokes the `Register` function.
- The `Register` function just prints out, "Hello, World!".

## Adding a logger

Let's create our first fx module inside our app for a better logger.

Create a folder called `logger` and a file called `logger.go` inside. Paste this into logger.go:

```sh
package logger

import (
	"go.uber.org/zap"
)

// ProvideLogger provides a zap logger
func ProvideLogger() *zap.SugaredLogger {
	logger, _ := zap.NewProduction()
	return logger.Sugar()
}

var Options = ProvideLogger
```

We're using another open-source library from Uber called zap. It makes logs pretty and structured.

Let's now include this provider in our main.go:

```sh
package main

import (
	"github.com/mager/my-example-project-999/logger"
	"go.uber.org/fx"
	"go.uber.org/zap"
)

func main() {
	fx.New(
		fx.Provide(
			logger.Options,
		),
		fx.Invoke(Register),
	).Run()
}

func Register(
	lc fx.Lifecycle,
	logger *zap.SugaredLogger,
) {
	logger.Infow("Hello, World!", "foo", "bar")
}
```

Here, we're adding a new function called fx.Provide, which takes the logger provider we just added. Another thing you'll notice is that our Register function now includes the logger. We replaced `fmt.Println` with `logger.Infow`.

Let's restart the app now, but first, we should make a shortcut so we don't have to type go mod tidy & go run main.go. Create a new file at the root called Makefile:

```make
dev:
	go mod tidy && go run main.go
```

Now we can just run `make dev`:

```sh
➜  make dev
go mod tidy && go run main.go
[Fx] PROVIDE	*zap.SugaredLogger <= github.com/mager/my-example-project-999/logger.ProvideLogger()
[Fx] PROVIDE	fx.Lifecycle <= go.uber.org/fx.New.func1()
[Fx] PROVIDE	fx.Shutdowner <= go.uber.org/fx.(*App).shutdowner-fm()
[Fx] PROVIDE	fx.DotGraph <= go.uber.org/fx.(*App).dotGraph-fm()
[Fx] INVOKE		main.Register()
{"level":"info","ts":1642341003.654142,"caller":"my-example-project-999/main.go:22","msg":"Hello, World!","foo":"bar"}
[Fx] RUNNING
```

The logger is much better now, and includes the line of code where it was called. You'll also noticed that we have sturctured logging with the `foo` & `bar` params.

## Adding a router & route handler

The next thing we're going to create is a router & handler for an API endpoint. We need a health check endpoint for our service, and we'll use this to keep the bot alive once it's deployed to Google Cloud Run.

Create a new folder called `router` with `router.go` inside.

```sh
package router

import (
	"context"
	"net/http"

	"github.com/gorilla/mux"
	"go.uber.org/fx"
	"go.uber.org/zap"
)

// ProvideRouter provides a gorilla mux router
func ProvideRouter(lc fx.Lifecycle, logger *zap.SugaredLogger) *mux.Router {
	var router = mux.NewRouter()

	router.Use(jsonMiddleware)

	lc.Append(
		fx.Hook{
			OnStart: func(context.Context) error {
				addr := ":8080"
				logger.Info("Listening on ", addr)

				go http.ListenAndServe(addr, router)

				return nil
			},
		},
	)

	return router
}

// jsonMiddleware makes sure that every response is JSON
func jsonMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

var Options = ProvideRouter
```

Even though it looks like there's a lot going on here, it's pretty basic:

- Initialize the router
- Inject some middleware to add a JSON header
- Create a new `fx` lifecycle method to start a server and listen on port 8080 when the app starts up

Let's add the router to main.go now:

```sh
package main

import (
	"github.com/gorilla/mux"
	"github.com/mager/my-example-project-999/logger"
	"github.com/mager/my-example-project-999/router"
	"go.uber.org/fx"
	"go.uber.org/zap"
)

func main() {
	fx.New(
		fx.Provide(
			logger.Options,
			router.Options,
		),
		fx.Invoke(Register),
	).Run()
}

func Register(
	lc fx.Lifecycle,
	logger *zap.SugaredLogger,
	router *mux.Router,
) {
	logger.Infow("Hello, World!", "foo", "bar")
}
```

Next, let's create a folder called `handler` with `handler.go` inside:

```sh
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"go.uber.org/zap"
)

type Resp struct {
	Status string `json:"status"`
}

// Handler struct for HTTP requests
type Handler struct {
	logger *zap.SugaredLogger
	router *mux.Router
}

// New creates a Handler struct
func New(
	logger *zap.SugaredLogger,
	router *mux.Router,
) *Handler {
	h := Handler{logger, router}
	h.registerRoutes()
	return &h
}

// RegisterRoutes registers all the routes for the route handler
func (h *Handler) registerRoutes() {
	h.router.HandleFunc("/health", h.health).Methods("GET")
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	var resp = Resp{Status: "OK"}

	json.NewEncoder(w).Encode(resp)
}
```

Here's the low down on the handler:

- We intialize a `Resp` struct, which will be the response of our endpoint.
- The `Handler` struct includes all the dependencies we'll soon pass in from main.go.
- We initialize the Handler struct with the logger & router, then call the registerRoutes function.
- `registerRoutes` defines all of the routes in our handler. Our handler is called `health`, and will be a `GET` request to `/health`.
- The `health` handler just responds with `OK`.

Let's update main.go now:

```go
package main

import (
	"github.com/gorilla/mux"
	"github.com/mager/my-example-project-999/handler"
	"github.com/mager/my-example-project-999/logger"
	"github.com/mager/my-example-project-999/router"
	"go.uber.org/fx"
	"go.uber.org/zap"
)

func main() {
	fx.New(
		fx.Provide(
			logger.Options,
			router.Options,
		),
		fx.Invoke(Register),
	).Run()
}

func Register(
	lc fx.Lifecycle,
	logger *zap.SugaredLogger,
	router *mux.Router,
) {
	logger.Infow("Hello, World!", "foo", "bar")

	handler.New(logger, router)
}
```

Run `make dev` and open a new terminal window. Run `curl localhost:8080/health` and you should get a response.

![](../images/blog/2022-01-16-gcloud-discord-bot/route-handler.png)

## Connecting to the Discord gateway

We're going to use the <a target="_blank" rel="noreferrer" href="https://github.com/bwmarrin/discordgo">`discordgo` library from `bwmarrin`</a> to connect to the Discord gateway.

_I'll continue this post later today..._
