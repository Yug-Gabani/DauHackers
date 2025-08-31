document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/coastal-status');
        const data = await response.json();

        // Update Beach Safety
        document.getElementById('beachSafetyCurrent').textContent = data.beachSafety.current;
        document.getElementById('beachSafetyUpdated').textContent = data.beachSafety.updated;

        // Update Tide Level
        document.getElementById('tideLevelValue').textContent = data.tideLevel.level;
        document.getElementById('tideLevelNextHigh').textContent = data.tideLevel.nextHigh;

        // Update Wind Speed
        document.getElementById('windSpeedValue').textContent = data.windSpeed.speed;
        document.getElementById('windSpeedDirection').textContent = data.windSpeed.direction;

        // Update Water Quality
        document.getElementById('waterQualityStatus').textContent = data.waterQuality.status;
        document.getElementById('waterQualityReported').textContent = data.waterQuality.reported;
    } catch (error) {
        console.error('Failed to fetch coastal status:', error);
    }
});