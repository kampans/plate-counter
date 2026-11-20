# Plate counter

Serve this folder with a local web server and open it in a browser (for example, `python -m http.server`).

Edit `config.js` to change the bar weight, plate colors, or profile dimensions in millimeters. The view shows one sleeve. Each selection adds a matching pair to the total.

## Calculator formulas

- Estimated 1RM uses Epley or Brzycki for sets of 1–10 reps. A single returns the entered weight. [Bench press validation study](https://paulogentil.com/pdf/TREINO%20DE%20FOR%C3%87A%CC%A7A/Avaliac%CC%A7a%CC%83o/Validation%20of%20Submaximal%20Prediction%20Equations%20for%20the%201RM%20Bench%20Press%20Test.pdf)
- DOTS uses the men's or women's curve and the bodyweight limits used by OpenPowerlifting. [OpenPowerlifting DOTS implementation](https://gitlab.com/openpowerlifting/opl-data/blob/main/crates/coefficients/src/dots.rs)
- IPF GL Points uses the published coefficients for division, equipment, and event, with six-decimal rounding before display. [IPF GL coefficient table and worked examples](https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf)

## Rankings

Open the **Rank** tab to compare full-power meet results against the included Irish federations. The browser uses bundled, anonymous score distributions. The data date on the page identifies the OpenPowerlifting snapshot.

Download the [OpenPowerlifting bulk ZIP](https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip), then run:

```sh
python scripts/build-rankings.py path/to/openpowerlifting-latest.zip
node --test tests/ranking.test.cjs
```

The builder also accepts an extracted CSV and supports `--dedupe latest`. Edit `config/federations.json` to add candidates or adjust inclusion thresholds. The GitHub Actions workflow rebuilds and commits the data weekly when enabled on the repository.
