#!/bin/bash -e

ps -ef | grep -v grep | grep -v check-process.sh | grep $1
