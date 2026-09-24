// Minimal assertion-based tests: no framework, non-zero exit on failure.
#include <iostream>

#include "greet.hpp"

static int failures = 0;

#define CHECK_EQ(actual, expected)                                           \
    do {                                                                     \
        if ((actual) != (expected)) {                                        \
            std::cerr << __FILE__ << ":" << __LINE__ << ": " #actual         \
                      << " == \"" << (actual) << "\", expected \""           \
                      << (expected) << "\"\n";                               \
            ++failures;                                                      \
        }                                                                    \
    } while (0)

int main() {
    CHECK_EQ(greet(), "Hello, world!");
    CHECK_EQ(greet("Claude"), "Hello, Claude!");

    if (failures == 0) std::cout << "all tests passed\n";
    return failures == 0 ? 0 : 1;
}
