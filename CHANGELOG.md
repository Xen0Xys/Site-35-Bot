# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-03-22

### Added

- Added `ELITE_SNIPER`, `HELICOPTER_LICENSE`, and `HEAVY_VEHICLE_LICENSE` trainings with role mapping and localization.
- Added related Prisma schema entries and migration for the new trainings.

### Changed

- Improved nickname parsing in rank and training commands to support both standard and unit pseudo formats.
- Updated training attribution logging to mention trainers correctly with safer allowed mentions handling.

## [1.1.0] - 2026-03-10

### Added

- Medal management with add/remove commands, medal channel parsing, and profile display.
- Instructor training support for FIM, CQC, and first aid.
- Medal and instructor role configuration entries in the example environment file.
- Created/updated timestamps for users, trainings, medals, and tracked messages.

### Changed

- Profile embed now separates specialties, qualifications, instructors, and medals.
- Training parsing now recognizes instructor mentions and aliases.
- Added logging for registration steps and safe role assignment skips.

### Fixed

- French accents in rank confirmation and status embed copy.

## [1.0.0] - 2026-03-05

### Added

- Discord bot for Site 35 with profile, rank, and training management.
- Slash commands to view profiles, manage trainings, and set ranks.
- Server status commands and public status display.
- GameDig integration for server status queries.
- Training role support and site security role support.
- New "drone" training type.

### Changed

- Case-insensitive autocomplete filtering for trainings and ranks.
- Message parsing supports multiple training and rank blocks.
- Stronger configuration and incoming message validation.
- Improved role assignment logic (CDT, Xi-8, site security).
- Added slash command interaction logging and richer Prisma logs.

### Fixed

- Minor fixes to profile and role handling.

### Refactored

- Reorganized role management and rank update flow.
- Moved updateUserRank function.

### Maintenance

- Dependency updates.
