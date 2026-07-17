# Real-Time 3D Asset Service

An API boundary for uploading and processing 3D assets used by a real-time viewer. The service validates metadata, deduplicates files by content hash, and creates asynchronous optimization jobs.

## Why this project

Real-time 3D products should not make browsers process arbitrary source assets. This service moves validation and optimization to controlled workers and gives the frontend a predictable asset contract.

## Features

- SHA-256 content-addressed deduplication
- Asset metadata validation
- Asynchronous optimization contract
- Clear separation between source and delivery formats
- Health and asset-status endpoints

## Production architecture

React/Three.js viewer → API → PostgreSQL metadata → object storage → worker queue → glTF/Draco optimizer.
