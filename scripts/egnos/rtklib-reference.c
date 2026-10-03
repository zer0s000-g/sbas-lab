/*
 * The independent reference for SBAS Lab's SBAS message decoder (src/core/sbasDecode.ts):
 * RTKLIB's own decoder (src/sbas.c, BSD 2-clause, T. Takasu) reads an EMS file and
 * prints, after chosen messages, the picture it has built: the PRN mask's IODP, every
 * fast correction (mask slot, PRC in m, UDREI) and every ionospheric grid point (band,
 * latitude, longitude, delay in m, GIVEI). tests/essp/replay.test.ts compares SBAS Lab's
 * decoder with this output, kept in tests/fixtures/rtklib-egnos-prn124-20110329-1500.json.
 *
 * Build against an RTKLIB checkout (https://github.com/tomojitakasu/RTKLIB) and run:
 *
 *   gcc -O1 -I RTKLIB/src scripts/egnos/rtklib-reference.c RTKLIB/src/sbas.c RTKLIB/src/rtkcmn.c -lm -o rtklib-reference
 *   ./rtklib-reference src/replay/data/egnos-prn124-20110329-1500.ems 99 299 599 899 > tests/fixtures/rtklib-egnos-prn124-20110329-1500.json
 */
#include <stdio.h>
#include <stdlib.h>
#include "rtklib.h"

static void dump(int idx, const nav_t *nav, int first)
{
    int i, b, k = 0;
    printf("%s{\"after\":%d,\"iodp\":%d,\"nsat\":%d,\"fast\":[", first ? "" : ",\n", idx, nav->sbssat.iodp, nav->sbssat.nsat);
    for (i = 0; i < nav->sbssat.nsat; i++) {
        const sbsfcorr_t *f = &nav->sbssat.sat[i].fcorr;
        if (f->t0.time == 0) continue;
        printf("%s[%d,%.3f,%d]", k++ ? "," : "", i, f->prc, f->udre - 1);
    }
    printf("],\"ion\":[");
    k = 0;
    for (b = 0; b <= MAXBAND; b++) {
        for (i = 0; i < nav->sbsion[b].nigp; i++) {
            const sbsigp_t *g = &nav->sbsion[b].igp[i];
            if (g->t0.time == 0) continue;
            printf("%s[%d,%d,%d,%.3f,%d]", k++ ? "," : "", b, g->lat, g->lon, g->delay, g->give == 0 ? 15 : g->give - 1);
        }
    }
    printf("]}");
}

int main(int argc, char **argv)
{
    sbs_t sbs = {0};
    static nav_t nav;
    static seph_t seph[NSATSBS * 2];
    int i, c, first = 1;
    if (argc < 3) {
        fprintf(stderr, "usage: rtklib-reference file.ems index...\n");
        return 1;
    }
    nav.seph = seph;
    nav.ns = NSATSBS * 2;
    sbsreadmsg(argv[1], 0, &sbs);
    printf("{\"messages\":%d,\"checkpoints\":[\n", sbs.n);
    for (i = 0; i < sbs.n; i++) {
        sbsupdatecorr(sbs.msgs + i, &nav);
        for (c = 2; c < argc; c++) {
            if (atoi(argv[c]) != i) continue;
            dump(i, &nav, first);
            first = 0;
        }
    }
    printf("\n]}\n");
    return 0;
}
