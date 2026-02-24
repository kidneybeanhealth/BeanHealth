/**
 * BluetoothPrinterService - Manages Bluetooth connection to thermal printers (ESC/POS)
 * Compatible with Rugtek BP02 and similar Bluetooth thermal printers
 * 
 * DEBUG MODE: Shows user-visible alerts for troubleshooting at hospital
 */

import { toast } from 'react-hot-toast';

// Debug mode - shows visible alerts for troubleshooting
const DEBUG_MODE = true;

// Helper to show debug messages
const debugAlert = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    if (!DEBUG_MODE) return;

    const icons: Record<string, string> = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };

    const fullMessage = `${icons[type]} ${message}`;

    switch (type) {
        case 'success':
            toast.success(fullMessage, { duration: 4000 });
            break;
        case 'error':
            toast.error(fullMessage, { duration: 6000 });
            break;
        default:
            toast(fullMessage, { duration: 4000, icon: icons[type] });
    }

    console.log(`[Printer Debug] ${message}`);
};

// Web Bluetooth API type declarations (not included in standard TypeScript lib)
declare global {
    interface Navigator {
        bluetooth: {
            requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
        };
    }

    interface RequestDeviceOptions {
        filters?: BluetoothRequestDeviceFilter[];
        optionalServices?: BluetoothServiceUUID[];
        acceptAllDevices?: boolean;
    }

    interface BluetoothRequestDeviceFilter {
        services?: BluetoothServiceUUID[];
        name?: string;
        namePrefix?: string;
    }

    type BluetoothServiceUUID = string | number;

    interface BluetoothDevice {
        name?: string;
        gatt?: BluetoothRemoteGATTServer;
        addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
    }

    interface BluetoothRemoteGATTServer {
        connected: boolean;
        connect(): Promise<BluetoothRemoteGATTServer>;
        disconnect(): void;
        getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
        getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
    }

    interface BluetoothRemoteGATTService {
        uuid: string;
        getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
    }

    interface BluetoothRemoteGATTCharacteristic {
        uuid: string;
        properties: BluetoothCharacteristicProperties;
        writeValue(value: BufferSource): Promise<void>;
        writeValueWithoutResponse(value: BufferSource): Promise<void>;
    }

    interface BluetoothCharacteristicProperties {
        write: boolean;
        writeWithoutResponse: boolean;
    }
}

// Standard Bluetooth Serial Port Profile UUID for printers
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';

// Alternative UUIDs that some printers use
const ALT_SERVICE_UUIDS = [
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
];

class BluetoothPrinterService {
    private device: BluetoothDevice | null = null;
    private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private foundServiceUUID: string | null = null;
    private foundCharUUID: string | null = null;

    /**
     * Check if Web Bluetooth is supported
     */
    isSupported(): boolean {
        return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    }

    /**
     * Check if currently connected to a printer
     */
    isConnected(): boolean {
        return this.device?.gatt?.connected === true && this.characteristic !== null;
    }

    /**
     * Get the connected device name
     */
    getDeviceName(): string | null {
        return this.device?.name || null;
    }

    /**
     * Get debug info for troubleshooting
     */
    getDebugInfo(): string {
        return `Device: ${this.device?.name || 'None'}, ` +
            `Connected: ${this.isConnected()}, ` +
            `Service: ${this.foundServiceUUID?.slice(-8) || 'None'}, ` +
            `Char: ${this.foundCharUUID?.slice(-8) || 'None'}`;
    }

    /**
     * Connect to a Bluetooth thermal printer
     * This will trigger the browser's Bluetooth device picker
     */
    async connect(): Promise<boolean> {
        if (!this.isSupported()) {
            debugAlert('Bluetooth not supported in this browser. Use Chrome!', 'error');
            throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.');
        }

        if (this.isConnecting) {
            debugAlert('Connection already in progress...', 'warning');
            throw new Error('Connection already in progress');
        }

        this.isConnecting = true;
        debugAlert('Step 1: Opening Bluetooth picker...', 'info');

        try {
            // Request device - this shows the browser's Bluetooth picker
            const allServiceUUIDs = [PRINTER_SERVICE_UUID, ...ALT_SERVICE_UUIDS];

            this.device = await navigator.bluetooth.requestDevice({
                // Accept any device that advertises as a printer or has serial service
                filters: [
                    { services: [PRINTER_SERVICE_UUID] },
                    { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] },
                    { namePrefix: 'Rugtek' },
                    { namePrefix: 'BP02' },
                    { namePrefix: 'Printer' },
                    { namePrefix: 'POS' }
                ],
                optionalServices: allServiceUUIDs
            }).catch(() => {
                debugAlert('Standard filter failed, trying all devices...', 'warning');
                // If filtered search fails, try accepting all devices
                return navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: allServiceUUIDs
                });
            });

            if (!this.device) {
                debugAlert('No device was selected!', 'error');
                throw new Error('No device selected');
            }

            debugAlert(`Step 2: Device selected: ${this.device.name || 'Unknown'}`, 'success');

            // Connect to GATT server
            debugAlert('Step 3: Connecting to GATT server...', 'info');
            const server = await this.device.gatt?.connect();
            if (!server) {
                debugAlert('GATT server connection failed!', 'error');
                throw new Error('Failed to connect to GATT server');
            }
            debugAlert('GATT server connected!', 'success');

            // Try to find the printer service
            debugAlert('Step 4: Searching for printer service...', 'info');
            let service: BluetoothRemoteGATTService | null = null;

            for (const uuid of allServiceUUIDs) {
                try {
                    service = await server.getPrimaryService(uuid);
                    if (service) {
                        this.foundServiceUUID = uuid;
                        debugAlert(`Found service: ${uuid.slice(-8)}`, 'success');
                        break;
                    }
                } catch {
                    // Try next UUID
                }
            }

            if (!service) {
                debugAlert('No standard service found, checking all services...', 'warning');
                // Try getting any available service
                const services = await server.getPrimaryServices();
                debugAlert(`Found ${services.length} services`, 'info');
                if (services.length > 0) {
                    service = services[0];
                    this.foundServiceUUID = service.uuid;
                    debugAlert(`Using service: ${service.uuid.slice(-8)}`, 'info');
                }
            }

            if (!service) {
                debugAlert('ERROR: No printer service found!', 'error');
                throw new Error('Could not find printer service');
            }

            // Get the write characteristic
            debugAlert('Step 5: Finding write characteristic...', 'info');
            const characteristics = await service.getCharacteristics();
            debugAlert(`Found ${characteristics.length} characteristics`, 'info');

            // Find a writable characteristic
            for (const char of characteristics) {
                const canWrite = char.properties.write;
                const canWriteNoResp = char.properties.writeWithoutResponse;

                if (canWrite || canWriteNoResp) {
                    this.characteristic = char;
                    this.foundCharUUID = char.uuid;
                    debugAlert(`Found writable char: ${char.uuid.slice(-8)} (write: ${canWrite}, writeNoResp: ${canWriteNoResp})`, 'success');
                    break;
                }
            }

            if (!this.characteristic) {
                debugAlert('ERROR: No writable characteristic found!', 'error');
                throw new Error('Could not find writable characteristic');
            }

            // Set up disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                debugAlert('Printer disconnected!', 'warning');
                this.handleDisconnect();
            });

            this.reconnectAttempts = 0;
            this.isConnecting = false;

            debugAlert(`🎉 Connected to ${this.device.name}!`, 'success');
            return true;

        } catch (error: any) {
            this.isConnecting = false;
            debugAlert(`Connection failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Handle disconnection - attempt to reconnect
     */
    private async handleDisconnect(): Promise<void> {
        this.characteristic = null;

        if (this.reconnectAttempts < this.maxReconnectAttempts && this.device) {
            this.reconnectAttempts++;
            debugAlert(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, 'warning');

            try {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                await this.reconnect();
            } catch (error: any) {
                debugAlert(`Reconnection failed: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Attempt to reconnect to the last connected device
     */
    async reconnect(): Promise<boolean> {
        if (!this.device) {
            throw new Error('No device to reconnect to');
        }

        try {
            const server = await this.device.gatt?.connect();
            if (!server) {
                throw new Error('Failed to reconnect to GATT server');
            }

            // Re-establish characteristic connection
            const services = await server.getPrimaryServices();
            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        this.characteristic = char;
                        debugAlert('Reconnected to printer!', 'success');
                        return true;
                    }
                }
            }

            throw new Error('Could not find writable characteristic on reconnect');
        } catch (error: any) {
            debugAlert(`Reconnect error: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Disconnect from the printer
     */
    async disconnect(): Promise<void> {
        if (this.device?.gatt?.connected) {
            this.device.gatt.disconnect();
        }
        this.device = null;
        this.characteristic = null;
        debugAlert('Disconnected from printer', 'info');
    }

    /**
     * Send raw data to the printer
     */
    async print(data: Uint8Array): Promise<void> {
        if (!this.isConnected() || !this.characteristic) {
            debugAlert('ERROR: Printer not connected!', 'error');
            throw new Error('Printer not connected');
        }

        debugAlert(`Printing ${data.length} bytes...`, 'info');

        const canWrite = this.characteristic.properties.write;
        const canWriteNoResp = this.characteristic.properties.writeWithoutResponse;

        debugAlert(`Write modes: write=${canWrite}, writeNoResp=${canWriteNoResp}`, 'info');

        // Rugtek BP02 works better with smaller chunks and longer delays
        const CHUNK_SIZE = 20; // Smaller chunks for Bluetooth stability

        try {
            let chunksSent = 0;
            const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);

                // Prefer writeValue (with response) for reliability
                if (canWrite) {
                    await this.characteristic.writeValue(chunk);
                } else if (canWriteNoResp) {
                    await this.characteristic.writeValueWithoutResponse(chunk);
                } else {
                    debugAlert('ERROR: No write capability!', 'error');
                    throw new Error('No write capability on characteristic');
                }

                chunksSent++;

                // Longer delay between chunks for Rugtek BP02
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            debugAlert(`✅ Print complete! (${chunksSent}/${totalChunks} chunks sent)`, 'success');
        } catch (error: any) {
            debugAlert(`Print error: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Print a test page
     */
    async printTestPage(): Promise<void> {
        debugAlert('Sending test page...', 'info');

        const encoder = new TextEncoder();

        // Build test data with extra line feeds to ensure paper advances
        const testData = new Uint8Array([
            0x1B, 0x40,           // Initialize printer (ESC @)
            0x1B, 0x61, 0x01,     // Center align (ESC a 1)
            0x1B, 0x21, 0x30,     // Double width + Double height (ESC ! 0x30)
            ...encoder.encode('TEST\n'),
            0x1B, 0x21, 0x00,     // Normal size (ESC ! 0x00)
            ...encoder.encode('===================\n'),
            ...encoder.encode('BeanHealth Hospital\n'),
            ...encoder.encode('Printer Working!\n'),
            ...encoder.encode('===================\n'),
            ...encoder.encode('\n'),
            ...encoder.encode('\n'),
            ...encoder.encode('\n'),
            ...encoder.encode('\n'),   // Extra line feeds ensure paper moves
            ...encoder.encode('\n'),
            0x1D, 0x56, 0x41, 0x03  // Partial cut with feed (GS V 65 3)
        ]);

        await this.print(testData);
        debugAlert('Test page sent to printer!', 'success');
    }

    /**
     * Simple line feed test - if this works, connection is good
     */
    async printSimpleTest(): Promise<void> {
        debugAlert('Sending simple test (6 line feeds)...', 'info');

        // Just send line feeds - if printer moves paper, connection works
        const simpleData = new Uint8Array([
            0x1B, 0x40,           // Initialize
            0x0A, 0x0A, 0x0A,     // 3 line feeds
            0x0A, 0x0A, 0x0A,     // 3 more line feeds
        ]);

        await this.print(simpleData);
        debugAlert('Simple test sent - paper should advance!', 'success');
    }
}

// Singleton instance
export const printerService = new BluetoothPrinterService();
export default BluetoothPrinterService;
