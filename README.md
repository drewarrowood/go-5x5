# 5×5 Go

A small Go board. Five lines by five lines. Black plays first.

## Play

Open `index.html` in a browser. No server.

- Click an empty point to place a stone.
- A move that leaves your own stones with no liberties is illegal, unless it takes.
- Ko: you may not immediately recapture the single stone that just captured.
- Pass. Two passes in a row end the game.
- Score is Chinese-style: your stones plus empty points you surround.
- Coordinates: A1 is bottom-left. The center is C3.

## Who plays

Black and White are each Human or Machine.

- Human vs machine, either color
- Two humans
- Machine vs machine: press Start, watch, Pause if you want. The speed control is slow enough to read the log.

New game clears the board and the log. Changing who plays takes effect on the next turn.

## The log

After every move — human or machine — one line is added: the point, and what that stone is doing here. Taking stones, filling a liberty, saving a group that had one liberty, connecting two groups, taking the center or a side, or a pass (no legal gain, or to end).

## Rules kept

Capture by liberty. Suicide forbidden unless it captures. Simple ko. No komi on 5×5.
