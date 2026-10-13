import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { Avatar } from '@/components/Avatar';
import { Button, IconButton } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { Photo } from '@/components/Photo';
import { SegmentedControl, TextField } from '@/components/Field';
import { Card, Divider, SectionHeader } from '@/components/Surface';
import { AppText } from '@/components/Text';
import { normalizeDateInput } from '@/lib/dates';
import { createEvent } from '@/lib/story';
import { fullName, parentsOf, partnersOf } from '@/lib/relations';
import { useFamilyStore } from '@/store/familyStore';
import { contentMaxWidth, useTheme } from '@/theme';
import { unionKey, type Gender, type LifeEvent, type UnionStatus } from '@/types';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

const UNION_OPTIONS: { value: UnionStatus; label: string }[] = [
  { value: 'married', label: 'Married' },
  { value: 'partners', label: 'Partners' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'separated', label: 'Separated' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
];

const RELATION_TITLE: Record<string, string> = {
  parent: 'Add a parent',
  child: 'Add a child',
  partner: 'Add a partner',
  sibling: 'Add a sibling',
};

export default function EditPersonScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; relation?: string; anchor?: string; coParent?: string }>();

  const people = useFamilyStore((state) => state.tree.people);
  const unions = useFamilyStore((state) => state.tree.unions);
  const addPerson = useFamilyStore((state) => state.addPerson);
  const addRelative = useFamilyStore((state) => state.addRelative);
  const updatePerson = useFamilyStore((state) => state.updatePerson);
  const unlinkParent = useFamilyStore((state) => state.unlinkParent);
  const unlinkPartner = useFamilyStore((state) => state.unlinkPartner);
  const setUnionStatus = useFamilyStore((state) => state.setUnionStatus);
  const setHome = useFamilyStore((state) => state.setHome);
  const homeId = useFamilyStore((state) => state.tree.homeId);

  const isNew = params.id === 'new';
  const existing = !isNew && params.id ? people[params.id] : undefined;
  const anchor = params.anchor ? people[params.anchor] : undefined;

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? (params.relation === 'child' ? (anchor?.lastName ?? '') : ''));
  const [birthName, setBirthName] = useState(existing?.birthName ?? '');
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [gender, setGender] = useState<Gender>(existing?.gender ?? 'other');
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? '');
  const [deathDate, setDeathDate] = useState(existing?.deathDate ?? '');
  const [deceased, setDeceased] = useState(existing?.deceased ?? Boolean(existing?.deathDate));
  const [birthPlace, setBirthPlace] = useState(existing?.birthPlace ?? '');
  const [occupation, setOccupation] = useState(existing?.occupation ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [photoUri, setPhotoUri] = useState(existing?.photoUri ?? '');
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [events, setEvents] = useState<LifeEvent[]>(existing?.events ?? []);
  const [unlinkTarget, setUnlinkTarget] = useState<{ kind: 'parent' | 'partner'; id: string } | null>(null);

  const previewPerson = useMemo(
    () => ({
      id: existing?.id ?? 'preview',
      firstName: firstName || 'New',
      lastName,
      gender,
      photoUri: photoUri || undefined,
      parentIds: [],
      partnerIds: [],
      createdAt: 0,
      updatedAt: 0,
    }),
    [existing?.id, firstName, gender, lastName, photoUri],
  );

  const title = isNew ? (params.relation ? RELATION_TITLE[params.relation] : 'Add a person') : 'Edit person';
  const canSave = firstName.trim().length > 0;

  async function pickImages(onPicked: (uris: string[]) => void, square: boolean) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && Platform.OS !== 'web') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: square,
      aspect: square ? [1, 1] : undefined,
      allowsMultipleSelection: !square,
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) onPicked(result.assets.map((asset) => asset.uri));
  }

  const pickPhoto = () => pickImages((uris) => setPhotoUri(uris[0]), true);
  const addToAlbum = () =>
    pickImages((uris) => setPhotos((current) => [...current, ...uris.filter((uri) => !current.includes(uri))]), false);

  function updateEvent(id: string, patch: Partial<LifeEvent>) {
    setEvents((current) => current.map((event) => (event.id === id ? { ...event, ...patch } : event)));
  }

  function save() {
    if (!canSave) return;
    const draft = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      birthName: birthName.trim() || undefined,
      nickname: nickname.trim() || undefined,
      gender,
      birthDate: birthDate ? normalizeDateInput(birthDate) : undefined,
      deathDate: deceased && deathDate ? normalizeDateInput(deathDate) : undefined,
      deceased,
      birthPlace: birthPlace.trim() || undefined,
      occupation: occupation.trim() || undefined,
      bio: bio.trim() || undefined,
      photoUri: photoUri || undefined,
      photos,
      events: events
        .filter((event) => event.title.trim().length > 0)
        .map((event) => ({
          ...event,
          title: event.title.trim(),
          date: event.date ? normalizeDateInput(event.date) : undefined,
          place: event.place?.trim() || undefined,
        })),
    };

    if (existing) {
      updatePerson(existing.id, draft);
      router.back();
      return;
    }

    let newId: string | null = null;
    if (params.relation && anchor) {
      newId = addRelative(anchor.id, params.relation as 'parent' | 'child' | 'partner' | 'sibling', draft, {
        otherParentId: params.coParent,
      });
    } else {
      newId = addPerson(draft);
      // The very first person in an empty tree is almost always "me".
      if (!homeId && Object.keys(people).length === 0) setHome(newId);
    }

    if (newId) router.replace({ pathname: '/person/[id]', params: { id: newId } });
    else router.back();
  }

  const parents = existing ? parentsOf(people, existing.id) : [];
  const partners = existing ? partnersOf(people, existing.id) : [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          paddingTop: insets.top + theme.space.sm,
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.bgElevated,
        }}>
        <IconButton icon="close" label="Cancel" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading" numberOfLines={1}>
            {title}
          </AppText>
          {anchor ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              Linked to {fullName(anchor)}
            </AppText>
          ) : null}
        </View>
        <Button label="Save" icon="check" size="sm" disabled={!canSave} onPress={save} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.space.lg,
          paddingBottom: insets.bottom + theme.space.xxxl,
          gap: theme.space.md,
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', gap: theme.space.sm, marginBottom: theme.space.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose a portrait" onPress={pickPhoto}>
            <Avatar person={previewPerson} size={92} />
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accent,
                borderWidth: 2,
                borderColor: theme.colors.bg,
              }}>
              <Icon name="camera" size={14} color={theme.colors.accentText} />
            </View>
          </Pressable>
          {photoUri ? (
            <Pressable accessibilityRole="button" onPress={() => setPhotoUri('')}>
              <AppText variant="caption" tone="muted">
                Remove photo
              </AppText>
            </Pressable>
          ) : (
            <AppText variant="caption" tone="faint">
              Tap to add a portrait
            </AppText>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <TextField
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ada"
            autoCapitalize="words"
            style={{ flex: 1 }}
          />
          <TextField
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Nwosu"
            autoCapitalize="words"
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <TextField
            label="Name at birth"
            value={birthName}
            onChangeText={setBirthName}
            placeholder="If it changed"
            autoCapitalize="words"
            style={{ flex: 1 }}
          />
          <TextField
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            placeholder="What people call them"
            style={{ flex: 1 }}
          />
        </View>

        <SegmentedControl label="Gender" options={GENDERS} value={gender} onChange={setGender} />

        <TextField
          label="Born"
          value={birthDate}
          onChangeText={setBirthDate}
          onBlur={() => setBirthDate((value) => (value ? normalizeDateInput(value) : ''))}
          placeholder="1985-09-08"
          hint="A year on its own is fine — 1985, 1985-09 or 1985-09-08."
          autoCapitalize="none"
        />

        <TextField label="Birthplace" value={birthPlace} onChangeText={setBirthPlace} placeholder="Manchester, England" />
        <TextField label="Work" value={occupation} onChangeText={setOccupation} placeholder="Paediatrician" />

        <SegmentedControl
          label="Status"
          options={[
            { value: 'living', label: 'Living' },
            { value: 'deceased', label: 'Deceased' },
          ]}
          value={deceased ? 'deceased' : 'living'}
          onChange={(value) => setDeceased(value === 'deceased')}
        />

        {deceased ? (
          <TextField
            label="Died"
            value={deathDate}
            onChangeText={setDeathDate}
            onBlur={() => setDeathDate((value) => (value ? normalizeDateInput(value) : ''))}
            placeholder="2016-02-03"
            hint="Leave blank if the date is unknown."
            autoCapitalize="none"
          />
        ) : null}

        <TextField
          label="Story"
          value={bio}
          onChangeText={setBio}
          placeholder="A memory, a habit, the thing everybody says about them…"
          multiline
        />

        <SectionHeader
          title="Photographs"
          action={
            <Pressable accessibilityRole="button" accessibilityLabel="Add photographs" onPress={addToAlbum}>
              <AppText variant="label" tone="accent">
                Add
              </AppText>
            </Pressable>
          }
        />
        {photos.length === 0 ? (
          <AppText variant="caption" tone="faint">
            Photographs show on the person&apos;s life canvas and in their album.
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {photos.map((uri) => (
              <View
                key={uri}
                style={{ width: '31.8%', aspectRatio: 1.18, borderRadius: theme.radius.sm, overflow: 'hidden' }}>
                <Photo uri={uri} style={{ width: '100%', height: '100%' }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove this photograph"
                  onPress={() => setPhotos((current) => current.filter((item) => item !== uri))}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.overlay,
                  }}>
                  <Icon name="close" size={12} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <SectionHeader
          title="Moments"
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a moment"
              onPress={() =>
                setEvents((current) => [...current, createEvent({ title: '', date: '', place: '' })])
              }>
              <AppText variant="label" tone="accent">
                Add
              </AppText>
            </Pressable>
          }
        />
        {events.length === 0 ? (
          <AppText variant="caption" tone="faint">
            Births and deaths come from the dates above. Anything else — a move, a marriage, a first job — goes here
            and builds the timeline.
          </AppText>
        ) : null}
        {events.map((event) => (
          <Card key={event.id} style={{ gap: theme.space.md }}>
            <View style={{ flexDirection: 'row', gap: theme.space.md }}>
              <TextField
                label="Year"
                value={event.date ?? ''}
                onChangeText={(value) => updateEvent(event.id, { date: value })}
                placeholder="1961"
                autoCapitalize="none"
                style={{ flex: 1 }}
              />
              <TextField
                label="Place"
                value={event.place ?? ''}
                onChangeText={(value) => updateEvent(event.id, { place: value })}
                placeholder="Dubrovnik"
                style={{ flex: 1.6 }}
              />
            </View>
            <TextField
              label="What happened"
              value={event.title}
              onChangeText={(value) => updateEvent(event.id, { title: value })}
              placeholder="Moves to Dubrovnik, starts work"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove this moment"
              onPress={() => setEvents((current) => current.filter((item) => item.id !== event.id))}
              style={{ alignSelf: 'flex-start' }}>
              <AppText variant="label" tone="danger">
                Remove
              </AppText>
            </Pressable>
          </Card>
        ))}

        {existing && (parents.length > 0 || partners.length > 0) ? (
          <>
            <SectionHeader title="Connections" />
            <Card padded={false}>
              {parents.map((parent, index) => (
                <View key={parent.id}>
                  {index > 0 ? <Divider inset={theme.space.lg} /> : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.space.md,
                      padding: theme.space.lg,
                    }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="caption" tone="faint">
                        PARENT
                      </AppText>
                      <AppText variant="bodyStrong">{fullName(parent)}</AppText>
                    </View>
                    <IconButton
                      icon="close"
                      label={`Unlink ${fullName(parent)}`}
                      size={32}
                      onPress={() => setUnlinkTarget({ kind: 'parent', id: parent.id })}
                    />
                  </View>
                </View>
              ))}

              {partners.map((partner, index) => {
                const key = unionKey(existing.id, partner.id);
                const union = unions[key];
                return (
                  <View key={partner.id}>
                    {index > 0 || parents.length > 0 ? <Divider inset={theme.space.lg} /> : null}
                    <View style={{ padding: theme.space.lg, gap: theme.space.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="caption" tone="faint">
                            PARTNER
                          </AppText>
                          <AppText variant="bodyStrong">{fullName(partner)}</AppText>
                        </View>
                        <IconButton
                          icon="close"
                          label={`Unlink ${fullName(partner)}`}
                          size={32}
                          onPress={() => setUnlinkTarget({ kind: 'partner', id: partner.id })}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
                        {UNION_OPTIONS.map((option) => {
                          const selected = (union?.status ?? 'married') === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              onPress={() => setUnionStatus(existing.id, partner.id, option.value)}
                              style={{
                                paddingHorizontal: theme.space.md,
                                height: 30,
                                justifyContent: 'center',
                                borderRadius: theme.radius.pill,
                                backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surfaceAlt,
                                borderWidth: 1,
                                borderColor: selected ? theme.colors.accent : 'transparent',
                              }}>
                              <AppText
                                variant="caption"
                                style={{ color: selected ? theme.colors.accent : theme.colors.textMuted }}>
                                {option.label}
                              </AppText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={Boolean(unlinkTarget)}
        title="Remove this connection?"
        message={
          unlinkTarget && existing
            ? `${fullName(people[unlinkTarget.id])} will stay in the tree, just no longer linked to ${fullName(existing)}.`
            : undefined
        }
        confirmLabel="Unlink"
        destructive
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={() => {
          if (unlinkTarget && existing) {
            if (unlinkTarget.kind === 'parent') unlinkParent(existing.id, unlinkTarget.id);
            else unlinkPartner(existing.id, unlinkTarget.id);
          }
          setUnlinkTarget(null);
        }}
      />
    </View>
  );
}
