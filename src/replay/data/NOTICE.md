# Recorded EGNOS messages

`egnos-prn124-20110329-1500.ems` holds the first 900 lines (15 minutes) of
`examples/20110325h15.ems` from the **EGNOS Toolkit 0.5.1**
(https://sourceforge.net/projects/libegnos/), the Linux port (maintained by
gAGE/UPC) of the EGNOS SDK that DKE Aerospace Germany GmbH developed and the
European GNSS Agency (GSA, now EUSPA) published on the EGNOS portal in 2011.

The file is in the format of ESA's EGNOS Message Server (EMS): one line per
second, `PRN YY MM DD hh mm ss MT HEX`, the hex being the 250-bit SBAS message
(and 6 padding bits). It was broadcast by PRN 124 on 29 March 2011 from 15:00
(GPS time); the file name says 25 March, its lines say 29 March.

The EGNOS Toolkit, and so this extract, is licensed under the European Union
Public Licence v1.1 (`LICENSE-EUPL-1.1.txt`). The extract is unmodified apart
from being cut to its first 900 lines.
