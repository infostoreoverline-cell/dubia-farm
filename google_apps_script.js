var SHEET_NAME = 'Foglio1';

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var headers = data[0];
    var result = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowData = {};
      for (var j = 0; j < headers.length; j++) {
        rowData[headers[j]] = row[j];
      }
      result.push(rowData);
    }

    var risposta = { status: "success", message: "Dati recuperati con successo", data: result };

    return ContentService.createTextOutput(JSON.stringify(risposta))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errore = { status: "error", message: err.toString() };
    return ContentService.createTextOutput(JSON.stringify(errore))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var risposta = { status: "error", message: "Richiesta non valida" };

  try {
    if (e.postData && e.postData.contents) {
      var datiRicevuti = JSON.parse(e.postData.contents);
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var newRow = [];

      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        newRow.push(datiRicevuti[header] !== undefined ? datiRicevuti[header] : "");
      }

      sheet.appendRow(newRow);

      risposta = { status: "success", message: "Dati salvati con successo" };
    }
  } catch (err) {
    risposta = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(risposta))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
