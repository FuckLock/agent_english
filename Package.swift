// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgentEnglishWorkspace",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgentEnglishCore",
            targets: ["AgentEnglishCore"]
        ),
        .executable(
            name: "AgentEnglishApp",
            targets: ["AgentEnglish"]
        ),
    ],
    targets: [
        .executableTarget(
            name: "AgentEnglish",
            dependencies: ["AgentEnglishCore"],
            path: "apps/ios/AgentEnglish"
        ),
        .target(
            name: "AgentEnglishCore",
            path: "apps/ios/AgentEnglishCore/Sources/AgentEnglishCore"
        ),
        .testTarget(
            name: "AgentEnglishTests",
            dependencies: ["AgentEnglishCore", "AgentEnglish"],
            path: "apps/ios/AgentEnglishTests"
        ),
    ]
)
