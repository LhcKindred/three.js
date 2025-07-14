/**
 * lDraw object packer
 *
 * Usage:
 *
 * - Download official parts library from lDraw.org and unzip in a directory (e.g. lDraw/)
 *
 * - Download your desired model file and place in the lDraw/models/ subfolder.
 *
 * - Place this script also in lDraw/
 *
 * - Issue command 'node packlDrawModel models/<modelFileName>'
 *
 * The packed object will be in lDraw/models/<modelFileName>_Packed.mpd and will contain all the object subtree as embedded files.
 *
 *
 */

const lDrawPath = './';
const materialsFileName = 'LDConfig.ldr';


import fs from 'fs';
import path from 'path';

if ( process.argv.length !== 3 ) {

	console.log( 'Usage: node packlDrawModel <modelFilePath>' );
	process.exit( 0 );

}

const fileName = process.argv[ 2 ];

const materialsFilePath = path.join( lDrawPath, materialsFileName );

console.log( 'Loading materials file "' + materialsFilePath + '"...' );
const materialsContent = fs.readFileSync( materialsFilePath, { encoding: 'utf8' } );

console.log( 'Packing "' + fileName + '"...' );

const objectsPaths = [];
const objectsContents = [];
const pathMap = {};
const listOfNotFound = [];

// Parse object tree
parseObject( fileName, true );

// Check if previously files not found are found now
// (if so, probably they were already embedded)
let someNotFound = false;
for ( let i = 0; i < listOfNotFound.length; i ++ ) {

	if ( ! pathMap[ listOfNotFound[ i ] ] ) {

		someNotFound = true;
		console.log( 'Error: File object not found: "' + fileName + '".' );

	}

}

if ( someNotFound ) {

	console.log( 'Some files were not found, aborting.' );
	process.exit( - 1 );

}

// Obtain packed content
let packedContent = materialsContent + '\n';
for ( let i = objectsPaths.length - 1; i >= 0; i -- ) {

	packedContent += objectsContents[ i ];

}

packedContent += '\n';

// Save output file
const outPath = fileName + '_Packed.mpd';
console.log( 'Writing "' + outPath + '"...' );
fs.writeFileSync( outPath, packedContent );

console.log( 'Done.' );


//

function parseObject( fileName, isRoot ) {

	// Returns the located path for fileName or null if not found

	console.log( 'Adding "' + fileName + '".' );

	const originalFileName = fileName;

	let prefix = '';
	let objectContent = null;
	for ( let attempt = 0; attempt < 2; attempt ++ ) {

		prefix = '';

		if ( attempt === 1 ) {

			fileName = fileName.toLowerCase();

		}

		if ( fileName.startsWith( '48/' ) ) {

			prefix = 'p/';

		} else if ( fileName.startsWith( 's/' ) ) {

			prefix = 'parts/';

		}

		let absoluteObjectPath = path.join( lDrawPath, fileName );

		try {

			objectContent = fs.readFileSync( absoluteObjectPath, { encoding: 'utf8' } );
			break;

		} catch ( e ) {

			prefix = 'parts/';
			absoluteObjectPath = path.join( lDrawPath, prefix, fileName );

			try {

				objectContent = fs.readFileSync( absoluteObjectPath, { encoding: 'utf8' } );
				break;

			} catch ( e ) {

				prefix = 'p/';
				absoluteObjectPath = path.join( lDrawPath, prefix, fileName );

				try {

					objectContent = fs.readFileSync( absoluteObjectPath, { encoding: 'utf8' } );
					break;

				} catch ( e ) {

					try {

						prefix = 'models/';
						absoluteObjectPath = path.join( lDrawPath, prefix, fileName );

						objectContent = fs.readFileSync( absoluteObjectPath, { encoding: 'utf8' } );
						break;

					} catch ( e ) {

						if ( attempt === 1 ) {

							// The file has not been found, add to list of not found.
							listOfNotFound.push( originalFileName );

						}

					}

				}

			}

		}

	}

	const objectPath = path.join( prefix, fileName ).trim().replace( /\\/g, '/' );

	if ( ! objectContent ) {

		// File was not found, but could be a referenced embedded file.
		return null;

	}

	if ( objectContent.indexOf( '\r\n' ) !== - 1 ) {

		// This is faster than String.split with regex that splits on both
		objectContent = objectContent.replace( /\r\n/g, '\n' );

	}

	let processedObjectContent = isRoot ? '' : '0 FILE ' + objectPath + '\n';

	const lines = objectContent.split( '\n' );

	for ( let i = 0, n = lines.length; i < n; i ++ ) {

		let line = lines[ i ];
		let lineLength = line.length;

		// Skip spaces/tabs
		let charIndex = 0;
		while ( ( line.charAt( charIndex ) === ' ' || line.charAt( charIndex ) === '\t' ) && charIndex < lineLength ) {

			charIndex ++;

		}

		line = line.substring( charIndex );
		lineLength = line.length;
		charIndex = 0;


		if ( line.startsWith( '0 FILE ' ) ) {

			if ( i === 0 ) {

				// Ignore first line FILE meta directive
				continue;

			}

			// Embedded object was found, add to path map

			const subObjectFileName = line.substring( charIndex ).trim().replace( /\\/g, '/' );

			if ( subObjectFileName ) {

				// Find name in path cache
				const subObjectPath = pathMap[ subObjectFileName ];

				if ( ! subObjectPath ) {

					pathMap[ subObjectFileName ] = subObjectFileName;

				}

			}

		}

		if ( line.startsWith( '1 ' ) ) {

			// subObject, add it
			charIndex = 2;

			// Skip material, position and transform
			for ( let token = 0; token < 13 && charIndex < lineLength; token ++ ) {

				// Skip token
				while ( line.charAt( charIndex ) !== ' ' && line.charAt( charIndex ) !== '\t' && charIndex < lineLength ) {

					charIndex ++;

				}

				// Skip spaces/tabs
				while ( ( line.charAt( charIndex ) === ' ' || line.charAt( charIndex ) === '\t' ) && charIndex < lineLength ) {

					charIndex ++;

				}

			}

			const subObjectFileName = line.substring( charIndex ).trim().replace( /\\/g, '/' );

			if ( subObjectFileName ) {

				// Find name in path cache
				let subObjectPath = pathMap[ subObjectFileName ];

				if ( ! subObjectPath ) {

					// Add new object
					subObjectPath = parseObject( subObjectFileName );

				}

				pathMap[ subObjectFileName ] = subObjectPath ? subObjectPath : subObjectFileName;

				processedObjectContent += line.substring( 0, charIndex ) + pathMap[ subObjectFileName ] + '\n';

			}

		} else {

			processedObjectContent += line + '\n';

		}

	}

	if ( objectsPaths.indexOf( objectPath ) < 0 ) {

		objectsPaths.push( objectPath );
		objectsContents.push( processedObjectContent );

	}

	return objectPath;

}
