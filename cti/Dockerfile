ARG GO_VER=1.21
ARG ALPINE_VER=3.17

FROM golang:${GO_VER}-alpine${ALPINE_VER}

WORKDIR /go/src/github.com/lasse/hlf/cti

COPY . .

RUN go mod tidy && go build -o ctiTransfer .

EXPOSE 9999

CMD ["./ctiTransfer"]