fn main() {
    let source_directory = std::path::Path::new("src");
    let parser = source_directory.join("parser.c");
    let scanner = source_directory.join("scanner.c");

    println!("cargo:rerun-if-changed={}", parser.display());
    println!("cargo:rerun-if-changed={}", scanner.display());

    let mut build = cc::Build::new();
    build.std("c11").include(source_directory);
    build.file(parser).file(scanner);

    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        build.flag("-utf-8");
    } else {
        build.flag_if_supported("-Wall");
        build.flag_if_supported("-Wextra");
        build.flag_if_supported("-Wpedantic");
    }

    build.compile("tree-sitter-avenger-sql");

    let format_directory = std::path::Path::new("format/src");
    let format_parser = format_directory.join("parser.c");
    println!("cargo:rerun-if-changed={}", format_parser.display());
    let mut format = cc::Build::new();
    format
        .std("c11")
        .include(format_directory)
        .file(format_parser);
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        format.flag("-utf-8");
    }
    format.compile("tree-sitter-avenger-format");
}
