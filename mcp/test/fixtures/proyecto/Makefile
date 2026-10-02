.PHONY: all clean
CC := gcc

all: build/prog

build/prog: build/main.o build/util.o | build
	$(CC) -o $@ $^

build/%.o: src/%.c | build
	$(CC) -c $< -o $@

build:
	mkdir -p build

clean:
	rm -rf build
