fn greet(name: Option<&str>) -> String {
    format!("Hello, {}!", name.unwrap_or("world"))
}

fn main() {
    println!("{}", greet(None));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_greeting() {
        assert_eq!(greet(None), "Hello, world!");
    }

    #[test]
    fn named_greeting() {
        assert_eq!(greet(Some("Claude")), "Hello, Claude!");
    }
}
