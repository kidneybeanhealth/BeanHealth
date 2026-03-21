export type DoctorActorType = 'chief' | 'assistant';

export interface DoctorActorSession {
    hospitalId: string;
    chiefDoctorId: string;
    sessionToken: string;
    sessionId: string;
    actorType: DoctorActorType;
    assistantId: string | null;
    actorDisplayName: string;
    expiresAt: string;
    canManageTeam: boolean;
    loginAt: number;
}

export const LEGACY_DOCTOR_SESSION_PREFIX = 'enterprise_doctor_session_';
export const DOCTOR_ACTOR_SESSION_PREFIX = 'enterprise_doctor_actor_session_';

export const getLegacyDoctorSessionKey = (hospitalId: string) =>
    `${LEGACY_DOCTOR_SESSION_PREFIX}${hospitalId}`;

export const getDoctorActorSessionKey = (hospitalId: string, chiefDoctorId: string) =>
    `${DOCTOR_ACTOR_SESSION_PREFIX}${hospitalId}_${chiefDoctorId}`;

export const saveDoctorActorSession = (session: DoctorActorSession) => {
    const key = getDoctorActorSessionKey(session.hospitalId, session.chiefDoctorId);
    sessionStorage.setItem(key, JSON.stringify(session));
};

export const loadDoctorActorSession = (hospitalId: string, chiefDoctorId: string): DoctorActorSession | null => {
    const key = getDoctorActorSessionKey(hospitalId, chiefDoctorId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as DoctorActorSession;
        if (
            !parsed ||
            parsed.hospitalId !== hospitalId ||
            parsed.chiefDoctorId !== chiefDoctorId ||
            !parsed.sessionToken
        ) {
            sessionStorage.removeItem(key);
            return null;
        }
        return parsed;
    } catch (_e) {
        sessionStorage.removeItem(key);
        return null;
    }
};

export const clearDoctorActorSession = (hospitalId: string, chiefDoctorId: string) => {
    sessionStorage.removeItem(getDoctorActorSessionKey(hospitalId, chiefDoctorId));
};

export const clearAllDoctorActorSessions = () => {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(DOCTOR_ACTOR_SESSION_PREFIX)) {
            keys.push(key);
        }
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
};
