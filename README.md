# Eros

![License](https://img.shields.io/badge/license-MIT-blue.svg)

**The intelligent, automated media manager for your adult content collection.**

Eros takes the chaos out of managing a large library. It automates the entire lifecycle of your content—from discovering new scenes from your favorite performers to downloading them with intelligent quality matching and organizing them with rich metadata.

## Why Eros?

Managing a local collection is often a manual, messy process. You have to check multiple sites for updates, manually search for torrents, rename files, and scrape metadata.

**Eros solves this by:**
- **Automating Discovery**: Automatically finding new content based on your subscriptions.
- **Ensuring Quality**: downloading the best version available based on your custom profiles.
- **Organizing Everything**: Keeping your library clean with consistent naming and rich metadata.

## Key Features

- **🎯 Smart Subscriptions**: Subscribe to **Performers**, **Studios**, or track specific **Scenes**. Eros monitors for new releases automatically.
- **🔌 Modular Architecture**: Built to be extensible.
  - **Metadata Providers**: Currently supports **StashDB** with a flexible plugin system for future providers.
  - **Download Clients**: Integrated with **qBittorrent**, with a design ready for other clients (Transmission, Deluge, etc.).
  - **Indexers**: Seamless integration with **Prowlarr** to access hundreds of trackers.
- **🧠 Intelligent Matching**: Uses advanced cross-encoder AI models to ensure the content found matches exactly what you're looking for—no more false positives.
- **⚡ Quality Profiles**: Define your preferred resolutions and formats (e.g., "2160p Preference", "1080p Only").
- **📁 Automated Organization**: Moves and renames files automatically, generating `.nfo` and downloading posters for compatibility with media servers like Plex/Jellyfin.

## Getting Started

The easiest way to run Eros is using Docker.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/eros.git
    cd eros
    ```

2.  **Configure Environment**
    Copy the example configuration to a production `.env` file.
    ```bash
    cp .env.example .env
    ```
    *Edit `.env` to set your Download paths and specific preferences.*

3.  **Start Services**
    ```bash
    docker-compose up -d
    ```

4.  **Access the Dashboard**
    Open your browser and navigate to:
    `http://localhost:3000`

    *Default Login:*
    - Username: `admin`
    - Password: `admin` (Change this immediately in settings!)

## Troubleshooting

### Permission Denied Errors

If you see errors like `EACCES: permission denied` when creating directories:

**Run on the HOST machine** (where docker-compose runs):

```bash
# Fix permissions for your media directory
sudo chown -R 1000:1000 /path/to/your/media/directory

# Or use more permissive permissions (less secure)
sudo chmod -R 777 /path/to/your/media/directory
```

**For common paths:**
```bash
# If using /mnt paths
sudo chown -R 1000:1000 /mnt/pve/DATA500

# If using /data paths
sudo chown -R 1000:1000 /data/your-media-folder
```

The container runs as UID:1000 (user `eros`). Make sure your media directories are writable by this user.

### Database Migration Errors

If you see migration errors on startup:

```bash
# Rebuild the container (will run migrations on startup)
docker-compose build
docker-compose up -d --force-recreate
```


## Contributing

We welcome contributions! Whether it's adding a new metadata provider, a new download client integration, or fixing a bug.

Please read `CLAUDE.md` for architectural guidelines if you are using AI assistants to help you code.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
