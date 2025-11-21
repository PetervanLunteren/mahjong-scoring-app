# Mahjong Scoring App

A web-based scoring application for Chinese Official Mahjong games.

## 🎮 Live App

**[Play Now: https://petervanlunteren.github.io/mahjong-scoring-app/](https://petervanlunteren.github.io/mahjong-scoring-app/)**

## Features

- **Automatic Score Calculation** - Just select who had Mahjong, enter points, and choose win type
- **Chinese Official Rules** - Follows standard dealer rotation and East doubling rules
- **Win Types Supported**:
  - Self-draw (自摸) - All 3 losers pay the winner
  - Win on discard (点炮) - Only discarder pays
- **East Doubling** - Automatic calculation when East is winner or payer
- **Dealer Rotation** - Dealer continues on win/draw, passes on non-dealer win
- **Hand History Table** - View all hands with score changes, winners, and dealers
- **Game State Persistence** - Uses localStorage to save your game
- **Responsive Design** - Optimized for iPad and desktop

## How to Use

1. **Setup**: Enter 4 player names and starting points (default: 25,000)
2. **Play**: For each hand:
   - Select who had Mahjong
   - Enter the points value
   - Choose win type (self-draw or discard)
   - View calculated scores
   - Submit the hand
3. **Track**: View complete game history in the table
4. **Undo**: Use "Undo Last Hand" if you make a mistake

## Technology

- Pure HTML, CSS, and JavaScript
- No build tools or dependencies
- Runs entirely in the browser
- Works offline after first load

## License

MIT
