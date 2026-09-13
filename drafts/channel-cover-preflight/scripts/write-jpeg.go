package main

import (
	"flag"
	"image"
	"image/color"
	"image/jpeg"
	"os"
)

func main() {
	out := flag.String("o", "", "output path")
	width := flag.Int("w", 0, "width")
	height := flag.Int("h", 0, "height")
	red := flag.Int("r", 0, "red")
	green := flag.Int("g", 0, "green")
	blue := flag.Int("b", 0, "blue")
	flag.Parse()
	if *out == "" || *width < 1 || *height < 1 {
		os.Exit(2)
	}
	img := image.NewRGBA(image.Rect(0, 0, *width, *height))
	fill := color.RGBA{R: uint8(*red), G: uint8(*green), B: uint8(*blue), A: 255}
	for y := 0; y < *height; y++ {
		for x := 0; x < *width; x++ {
			img.Set(x, y, fill)
		}
	}
	file, err := os.Create(*out)
	if err != nil {
		panic(err)
	}
	defer file.Close()
	if err := jpeg.Encode(file, img, &jpeg.Options{Quality: 90}); err != nil {
		panic(err)
	}
}
