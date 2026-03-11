/**
 * BluetoothPrinterService - Manages Bluetooth connection to thermal printers (ESC/POS)
 * Compatible with Rugtek BP02 and similar Bluetooth thermal printers
 */

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
        getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
    }

    interface BluetoothRemoteGATTCharacteristic {
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
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

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
     * Connect to a Bluetooth thermal printer
     * This will trigger the browser's Bluetooth device picker
     */
    async connect(): Promise<boolean> {
        if (!this.isSupported()) {
            throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.');
        }

        if (this.isConnecting) {
            throw new Error('Connection already in progress');
        }

        this.isConnecting = true;

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
                // If filtered search fails, try accepting all devices
                return navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: allServiceUUIDs
                });
            });

            if (!this.device) {
                throw new Error('No device selected');
            }

            // Connect to GATT server
            const server = await this.device.gatt?.connect();
            if (!server) {
                throw new Error('Failed to connect to GATT server');
            }

            // Try to find the printer service
            let service: BluetoothRemoteGATTService | null = null;

            for (const uuid of allServiceUUIDs) {
                try {
                    service = await server.getPrimaryService(uuid);
                    if (service) break;
                } catch {
                    // Try next UUID
                }
            }

            if (!service) {
                // Try getting any available service
                const services = await server.getPrimaryServices();
                if (services.length > 0) {
                    service = services[0];
                }
            }

            if (!service) {
                throw new Error('Could not find printer service');
            }

            // Get the write characteristic
            const characteristics = await service.getCharacteristics();

            // Find a writable characteristic
            for (const char of characteristics) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                    this.characteristic = char;
                    break;
                }
            }

            if (!this.characteristic) {
                throw new Error('Could not find writable characteristic');
            }

            // Set up disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('Printer disconnected');
                this.handleDisconnect();
            });

            this.reconnectAttempts = 0;
            this.isConnecting = false;

            console.log('Connected to printer:', this.device.name);
            return true;

        } catch (error: any) {
            this.isConnecting = false;
            console.error('Bluetooth connection error:', error);
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
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            try {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                await this.reconnect();
            } catch (error) {
                console.error('Reconnection failed:', error);
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
                        console.log('Reconnected to printer');
                        return true;
                    }
                }
            }

            throw new Error('Could not find writable characteristic on reconnect');
        } catch (error) {
            console.error('Reconnect error:', error);
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
    }

    /**
     * Send raw data to the printer
     */
    async print(data: Uint8Array): Promise<void> {
        if (!this.isConnected() || !this.characteristic) {
            throw new Error('Printer not connected');
        }

        // Some printers have a max packet size, so we chunk the data
        const CHUNK_SIZE = 100;

        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunk = data.slice(i, i + CHUNK_SIZE);

            if (this.characteristic.properties.writeWithoutResponse) {
                await this.characteristic.writeValueWithoutResponse(chunk);
            } else {
                await this.characteristic.writeValue(chunk);
            }

            // Small delay between chunks to prevent buffer overflow
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }

    /**
     * Print a test page
     */
    async printTestPage(): Promise<void> {
        const encoder = new TextEncoder();
        const testData = new Uint8Array([
            0x1B, 0x40,           // Initialize printer
            0x1B, 0x61, 0x01,     // Center align
            ...encoder.encode('=== TEST PRINT ===\n'),
            ...encoder.encode('BeanHealth Hospital\n'),
            ...encoder.encode('Printer Connected!\n'),
            ...encoder.encode('==================\n\n\n'),
            0x1D, 0x56, 0x00      // Paper cut
        ]);

        await this.print(testData);
    }
}

// Singleton instance
export const printerService = new BluetoothPrinterService();
export default BluetoothPrinterService;
