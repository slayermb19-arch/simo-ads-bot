# VCamera Plus (project plan)

This directory documents the planned Android project combining a virtual-camera media selector with a separate, permission-respecting app workspace.

## Planned modules

- **Media source manager:** choose local video or image, preview it, loop playback, and manage rotation/scale/position settings.
- **Privacy tools:** explain camera permissions and provide quick access to Android privacy settings.
- **App workspace research:** investigate legitimate Android multi-user/profile APIs and app-cloning limits. This is not a system-wide Parallel Space engine yet.
- **Build pipeline:** GitHub Actions Android build once a buildable Gradle project and dependencies are present.

## Important status

This is a planning/documentation scaffold, not an APK or a working virtual camera. Android does not provide a standard public API for replacing the camera feed in every third-party app. Support depends on OS version, app restrictions, and compatible implementation methods.

## Upstream

VCamera source: https://github.com/andvipgroup/VCamera

The upstream project is licensed under AGPL-3.0. A derivative that incorporates its code must comply with that license, including applicable source distribution requirements. Review dependencies, submodules, trademarks, and build configuration before distributing binaries.

## Safe development roadmap

1. Import and build the upstream code in a clean branch/fork, preserving its license.
2. Verify submodules and required dependencies; build an unmodified debug APK first.
3. Add a distinct app identity and UI only after the baseline build works.
4. Prototype a local media picker/preview and playback controls.
5. Evaluate official Android work profiles / secondary-user capabilities for the app workspace.
6. Configure CI to build and publish an APK artifact only after builds and tests pass.

## Build

Open the project in Android Studio and run a Gradle sync/build. Do not advertise a successful APK until CI or a local Android SDK build completes successfully.
