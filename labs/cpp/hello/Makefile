CXX      ?= g++
CXXFLAGS ?= -std=c++20 -Wall -Wextra -Werror -O2

# Every .cpp except main.cpp and test_*.cpp is shared library code.
LIB   := $(filter-out main.cpp test_%.cpp,$(wildcard *.cpp))
TESTS := $(wildcard test_*.cpp)

.PHONY: run test clean

build/main: main.cpp $(LIB) $(wildcard *.hpp)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -o $@ main.cpp $(LIB)

build/test: $(TESTS) $(LIB) $(wildcard *.hpp)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -o $@ $(TESTS) $(LIB)

run: build/main
	@./build/main

test: build/test
	@./build/test

clean:
	rm -rf build
