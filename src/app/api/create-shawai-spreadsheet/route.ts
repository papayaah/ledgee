import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    // Create a new spreadsheet using Google Sheets API with Backup sheet
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: 'Ledgee'
        },
        sheets: [
          {
            properties: {
              title: 'Backup',
              gridProperties: {
                rowCount: 1000,
                columnCount: 50
              }
            }
          }
        ]
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      console.error('Failed to create spreadsheet:', errorData);
      return NextResponse.json(
        { error: 'Failed to create spreadsheet' },
        { status: createResponse.status }
      );
    }

    const spreadsheet = await createResponse.json();
    const spreadsheetId = spreadsheet.spreadsheetId;
    const spreadsheetUrl = spreadsheet.spreadsheetUrl;
    const backupSheetId = spreadsheet.sheets[0].properties.sheetId;

    // Lock the Backup sheet to prevent accidental edits
    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addProtectedRange: {
                protectedRange: {
                  range: {
                    sheetId: backupSheetId
                  },
                  description: 'Protected by Ledgee - Backup data sheet',
                  warningOnly: false
                }
              }
            }
          ]
        })
      });
      console.log('Backup sheet locked successfully');
    } catch (error) {
      console.error('Failed to lock Backup sheet:', error);
      // Continue anyway - sheet is created even if locking fails
    }

    return NextResponse.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl
    });
  } catch (error) {
    console.error('Error creating Ledgee spreadsheet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

