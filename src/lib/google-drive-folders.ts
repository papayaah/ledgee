'use client';

// Google Drive folder management for user's OAuth account

export interface GoogleDriveFolder {
  id: string;
  name: string;
}

export class GoogleDriveFolders {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // Find or create a folder by name
  async findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    // First, try to find existing folder
    const existingFolder = await this.findFolder(folderName, parentId);
    if (existingFolder) {
      return existingFolder.id;
    }

    // Create new folder
    return await this.createFolder(folderName, parentId);
  }

  // Search for a folder by name
  private async findFolder(folderName: string, parentId?: string): Promise<GoogleDriveFolder | null> {
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += ` and 'root' in parents`;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to search for folder:', await response.text());
      return null;
    }

    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }

    return null;
  }

  // Create a new folder
  private async createFolder(folderName: string, parentId?: string): Promise<string> {
    const metadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentId) {
      metadata.parents = [parentId];
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw new Error(`Failed to create folder: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`✅ Created folder "${folderName}" with ID: ${data.id}`);
    return data.id;
  }

  // Setup Ledgee folder structure: Ledgee/Invoices
  async setupLedgeeFolders(): Promise<{ ledgeeFolderId: string; invoicesFolderId: string }> {
    // Create or find "Ledgee" folder
    const ledgeeFolderId = await this.findOrCreateFolder('Ledgee');
    console.log('📁 Ledgee folder ID:', ledgeeFolderId);

    // Create or find "Invoices" subfolder inside Ledgee
    const invoicesFolderId = await this.findOrCreateFolder('Invoices', ledgeeFolderId);
    console.log('📁 Invoices folder ID:', invoicesFolderId);

    return {
      ledgeeFolderId,
      invoicesFolderId,
    };
  }

  // Upload image to specified folder
  async uploadImage(imageData: string, fileName: string, folderId: string): Promise<string | null> {
    try {
      console.log(`📤 [Drive] Uploading image: ${fileName} to folder ${folderId}`);

      // Convert base64 to blob
      const base64Data = imageData.split(',')[1];
      const mimeType = imageData.split(',')[0].split(':')[1].split(';')[0];
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays.push(byteCharacters.charCodeAt(i));
      }
      
      const blob = new Blob([new Uint8Array(byteArrays)], { type: mimeType });

      // Create file metadata
      const metadata = {
        name: fileName,
        mimeType: mimeType,
        parents: [folderId]
      };

      // Upload to Google Drive using multipart upload
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: form
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ [Drive] Upload failed:', errorText);
        throw new Error(`Failed to upload to Drive: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const fileData = await uploadResponse.json();
      const fileId = fileData.id;

      console.log(`✅ [Drive] Uploaded successfully! File ID: ${fileId}`);

      // Make the file publicly accessible (view only)
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });

      // Return the shareable link
      const driveLink = `https://drive.google.com/uc?id=${fileId}`;
      console.log(`🔗 [Drive] Shareable link: ${driveLink}`);
      
      return driveLink;
    } catch (error) {
      console.error('❌ [Drive] Failed to upload image:', error);
      return null;
    }
  }
}

