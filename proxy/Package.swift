// proxy/Package.swift
// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "ProbeProxy",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.115.0"),
    ],
    targets: [
        .executableTarget(
            name: "ProbeProxy",
            dependencies: [.product(name: "Vapor", package: "vapor")],
            swiftSettings: [.enableUpcomingFeature("ExistentialAny")]
        ),
        .testTarget(
            name: "ProbeProxyTests",
            dependencies: [
                .target(name: "ProbeProxy"),
                .product(name: "VaporTesting", package: "vapor"),
            ],
            swiftSettings: [.enableUpcomingFeature("ExistentialAny")]
        ),
    ]
)
